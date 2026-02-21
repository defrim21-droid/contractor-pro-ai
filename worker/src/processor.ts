import sharp from 'sharp';
import { fal } from '@fal-ai/client';
import { buildPrompt, COLOR_NAMES } from './prompt.js';
import { supabase } from './supabase.js';

const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const BUCKET = 'project-images-public';
const FAL_MAX_DIMENSION = 1536;

async function resolveMaskToBuffer(maskInput: string): Promise<Buffer> {
  if (maskInput.startsWith('http://') || maskInput.startsWith('https://')) {
    const resp = await fetch(maskInput);
    return Buffer.from(await resp.arrayBuffer());
  }
  const base64 = maskInput.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/** Fal.ai mask: white = inpaint, black = preserve. Our mask: transparent = edit, opaque = preserve. Returns PNG buffer. */
async function convertMaskToFalFormatBuffer(
  maskInput: string,
  width: number,
  height: number
): Promise<Buffer> {
  const input = await resolveMaskToBuffer(maskInput);
  const { data } = await sharp(input).ensureAlpha().resize(width, height).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    const v = a < 128 ? 255 : 0; // transparent (edit) → white, opaque (preserve) → black
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

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

/** Resize image to fit within max dimension; return buffer and final dimensions. */
async function resizeImageForFal(imageUrl: string): Promise<{ buffer: Buffer; w: number; h: number }> {
  const buffer = await resolveMaskToBuffer(imageUrl);
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  const scale =
    w > FAL_MAX_DIMENSION || h > FAL_MAX_DIMENSION ? FAL_MAX_DIMENSION / Math.max(w, h) : 1;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const resized = scale < 1 ? await sharp(buffer).resize(nw, nh).png().toBuffer() : buffer;
  return { buffer: resized, w: nw, h: nh };
}

/** Upload buffer to Fal storage. */
async function uploadToFalStorage(falKey: string, buffer: Buffer, type = 'image/png'): Promise<string> {
  fal.config({ credentials: falKey });
  const blob = new Blob([new Uint8Array(buffer)], { type });
  return fal.storage.upload(blob);
}

/** Fal.ai Flux General inpainting — strict mask adherence + reference image (IP-Adapter-style). */
async function runFalFluxInpaint(
  falKey: string,
  inputImageUrl: string,
  maskInput: string,
  editPrompt: string,
  referenceImageUrl: string | null
): Promise<string> {
  fal.config({ credentials: falKey });

  // Resize input to Fal limits; mask must match resized dimensions
  const { buffer: inputBuffer, w: targetW, h: targetH } = await resizeImageForFal(inputImageUrl);
  const maskBuffer = await convertMaskToFalFormatBuffer(maskInput, targetW, targetH);

  // Upload all to Fal storage (avoids file_download_error and image_too_large)
  const [inputImageFalUrl, maskUrl, refUrl] = await Promise.all([
    uploadToFalStorage(falKey, inputBuffer),
    uploadToFalStorage(falKey, maskBuffer),
    referenceImageUrl?.trim()
      ? resizeImageForFal(referenceImageUrl).then((r) => uploadToFalStorage(falKey, r.buffer))
      : Promise.resolve(null),
  ]);

  const input: Record<string, unknown> = {
    prompt: editPrompt,
    image_url: inputImageFalUrl,
    mask_url: maskUrl,
    negative_prompt:
      'blurry, low quality, distorted, cartoon, painting, illustration, moldings, window trim, decorative trim, added trim, new trim, architectural ornamentation, extra elements outside mask',
    strength: 0.82,
  };

  if (refUrl) {
    input.reference_image_url = refUrl;
    input.reference_strength = 0.7;
  }

  let result;
  try {
    result = await fal.subscribe('fal-ai/flux-general/inpainting', {
      input: input as any,
      logs: true,
    });
  } catch (err) {
    const e = err as any;
    const detail = e?.detail ?? e?.body ?? (typeof e?.json === 'function' ? await e.json().catch(() => null) : null);
    const errStr = typeof detail === 'object' ? JSON.stringify(detail) : String(detail ?? '');
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[runFalFluxInpaint] Fal API error: status=${e?.status} detail=${errStr} message=${msg}`);
    const userMsg = Array.isArray(detail) && detail[0]?.msg ? detail[0].msg : msg;
    throw new Error(userMsg || 'Fal inpainting failed');
  }

  const images = (result.data as { images?: { url?: string }[] })?.images;
  const resultImageUrl = images?.[0]?.url;
  if (!resultImageUrl) throw new Error('No image in Fal inpainting response');

  const resp = await fetch(resultImageUrl);
  const ab = await resp.arrayBuffer();
  const b64 = Buffer.from(ab).toString('base64');
  return `data:image/png;base64,${b64}`;
}

export async function processJob(
  openaiKey: string,
  falKey: string | undefined,
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

  console.log(
    `[processJob] project=${projectId} hasMask=${hasMask} maskRegions=${maskRegions.length} maskImageUrl=${!!maskImageUrl} → ${hasMask ? 'Fal' : 'OpenAI'}`
  );

  const baseUrl =
    rawInputImageUrl && typeof rawInputImageUrl === 'string' && rawInputImageUrl.trim().length > 0
      ? rawInputImageUrl.trim()
      : baseImageUrl;

  let lastResultB64: string;

  if (hasMask) {
    // Route to Fal.ai SDXL inpainting — strict mask adherence
    if (!falKey) throw new Error('FAL_KEY required for masked edits. Add FAL_KEY to your environment.');
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
        const refUrl = samples[region.sampleIndex]?.url?.trim() || null;
        const dataUrl = await runFalFluxInpaint(falKey, currentImageUrl, region.mask, regionPrompt, refUrl);
        currentImageUrl = dataUrl;
      }
      lastResultB64 = currentImageUrl.replace(/^data:image\/\w+;base64,/, '');
    } else {
      const maskUrl = maskImageUrl?.trim() ?? maskRegions[0]?.mask ?? null;
      if (!maskUrl) throw new Error('Mask required for masked edit');
      const fullPrompt =
        maskRegions.length === 1
          ? buildPrompt(prompt, projectType, true, {
              sampleIndex: maskRegions[0].sampleIndex,
              sampleName: samples[maskRegions[0].sampleIndex]?.name || `Sample ${maskRegions[0].sampleIndex + 1}`,
              colorName: COLOR_NAMES[maskRegions[0].sampleIndex] ?? `sample ${maskRegions[0].sampleIndex + 1}`,
            })
          : buildPrompt(prompt, projectType, true);
      const refUrl =
        maskRegions.length === 1
          ? (samples[maskRegions[0]!.sampleIndex]?.url?.trim() || null)
          : (samples[0]?.url?.trim() || null);
      const dataUrl = await runFalFluxInpaint(falKey, baseUrl, maskUrl, fullPrompt, refUrl);
      lastResultB64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    }
  } else {
    // Route to OpenAI Image Edits — no mask
    const fullPrompt = buildPrompt(prompt, projectType, false);
    const dataUrl = await runEdit(openaiKey, baseUrl, null, fullPrompt, samples);
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
