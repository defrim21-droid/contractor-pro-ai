import sharp from 'sharp';
import { buildPrompt, COLOR_NAMES } from './prompt.js';
import { supabase } from './supabase.js';

const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const BUCKET = 'project-images-public';

export interface JobPayload {
  prompt: string;
  samples: { name: string; url: string }[];
  mask?: string;
  maskRegions?: { sampleIndex: number; mask: string }[];
  inputImageUrl?: string;
  projectType: string | null;
}

async function getImageDimensions(imageUrl: string): Promise<{ w: number; h: number }> {
  const isDataUrl = imageUrl.startsWith('data:');
  let buffer: Buffer;
  if (isDataUrl) {
    const base64 = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    buffer = Buffer.from(base64, 'base64');
  } else {
    const resp = await fetch(imageUrl);
    const ab = await resp.arrayBuffer();
    buffer = Buffer.from(ab);
  }
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) throw new Error('Could not read image dimensions');
  return { w: meta.width, h: meta.height };
}

async function resizeMaskToMatch(maskDataUrl: string, targetW: number, targetH: number): Promise<string> {
  const base64 = maskDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const input = Buffer.from(base64, 'base64');
  const meta = await sharp(input).metadata();
  if (meta.width === targetW && meta.height === targetH) return maskDataUrl;
  const out = await sharp(input).resize(targetW, targetH).png().toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

async function runEdit(
  openaiKey: string,
  inputImageUrl: string,
  maskUrl: string | null,
  editPrompt: string,
  samples: { name: string; url: string }[]
): Promise<string> {
  const refs = [{ image_url: inputImageUrl }];
  for (const s of samples) refs.push({ image_url: s.url.trim() });
  let finalMaskUrl = maskUrl?.trim() || null;
  if (finalMaskUrl) {
    try {
      const imgDims = await getImageDimensions(inputImageUrl);
      finalMaskUrl = await resizeMaskToMatch(finalMaskUrl, imgDims.w, imgDims.h);
    } catch (e) {
      console.warn('Mask resize failed, using original:', e);
    }
  }
  const bodyPayload: Record<string, unknown> = {
    model: 'gpt-image-1.5',
    images: refs,
    prompt: editPrompt,
    input_fidelity: 'high',
    n: 1,
    size: 'auto',
    quality: 'high',
    output_format: 'png',
  };
  if (finalMaskUrl) bodyPayload.mask = { image_url: finalMaskUrl };
  const res = await fetch(OPENAI_EDITS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify(bodyPayload),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(errBody || 'OpenAI request failed');
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in response');
  return `data:image/png;base64,${b64}`;
}

export async function processJob(
  openaiKey: string,
  projectId: string,
  userId: string,
  baseImageUrl: string,
  projectType: string | null,
  payload: JobPayload
): Promise<string> {
  const { prompt, samples, mask: maskImageUrl, maskRegions: rawMaskRegions, inputImageUrl: rawInputImageUrl } =
    payload;
  const maskRegions = Array.isArray(rawMaskRegions)
    ? rawMaskRegions.filter(
        (r) => r && typeof r.sampleIndex === 'number' && typeof r.mask === 'string' && r.mask.trim().length > 0
      )
    : [];
  const hasMask =
    !!(maskImageUrl && typeof maskImageUrl === 'string' && maskImageUrl.trim().length > 0) || maskRegions.length > 0;
  const baseUrl =
    rawInputImageUrl && typeof rawInputImageUrl === 'string' && rawInputImageUrl.trim().length > 0
      ? rawInputImageUrl.trim()
      : baseImageUrl;

  let lastResultB64: string;

  if (maskRegions.length > 1) {
    let currentImageUrl = baseUrl;
    for (let i = 0; i < maskRegions.length; i++) {
      const region = maskRegions[i];
      const sampleName = samples[region.sampleIndex]?.name || `Sample ${region.sampleIndex + 1}`;
      const colorName = COLOR_NAMES[region.sampleIndex] ?? `sample ${region.sampleIndex + 1}`;
      const regionPrompt = buildPrompt(prompt, projectType, true, {
        sampleIndex: region.sampleIndex,
        sampleName,
        colorName,
      });
      const dataUrl = await runEdit(openaiKey, currentImageUrl, region.mask, regionPrompt, samples);
      currentImageUrl = dataUrl;
    }
    lastResultB64 = currentImageUrl.replace(/^data:image\/\w+;base64,/, '');
  } else {
    const maskUrl = hasMask && maskImageUrl ? maskImageUrl.trim() : maskRegions[0]?.mask ?? null;
    const fullPrompt =
      maskRegions.length === 1
        ? buildPrompt(prompt, projectType, true, {
            sampleIndex: maskRegions[0].sampleIndex,
            sampleName: samples[maskRegions[0].sampleIndex]?.name || `Sample ${maskRegions[0].sampleIndex + 1}`,
            colorName: COLOR_NAMES[maskRegions[0].sampleIndex] ?? `sample ${maskRegions[0].sampleIndex + 1}`,
          })
        : buildPrompt(prompt, projectType, hasMask);
    const dataUrl = await runEdit(openaiKey, baseUrl, maskUrl, fullPrompt, samples);
    lastResultB64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  }

  const binary = Buffer.from(lastResultB64, 'base64');
  const timestamp = Date.now();
  const path = `renders/${userId}/${projectId}-${timestamp}.png`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, binary, {
    contentType: 'image/png',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}
