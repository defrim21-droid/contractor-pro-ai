import sharp from 'sharp';
import { buildPrompt, COLOR_NAMES } from './prompt.js';
import { supabase } from './supabase.js';

const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const OPENAI_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const BUCKET = 'project-images-public';

async function resolveMaskToBuffer(maskInput: string): Promise<Buffer> {
  if (maskInput.startsWith('http://') || maskInput.startsWith('https://')) {
    const resp = await fetch(maskInput);
    return Buffer.from(await resp.arrayBuffer());
  }
  const base64 = maskInput.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/** Create markup image for Gemini: base image + red overlay where mask says edit (Nano Banana style). */
async function createMarkupImage(
  baseImageUrl: string,
  maskInput: string,
  width: number,
  height: number
): Promise<Buffer> {
  const [baseBuffer, maskBuffer] = await Promise.all([
    resolveMaskToBuffer(baseImageUrl),
    (async () => {
      const buf = await resolveMaskToBuffer(maskInput);
      const resized = await sharp(buf).resize(width, height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return resized;
    })(),
  ]);

  const base = await sharp(baseBuffer).resize(width, height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: baseData } = base;
  const { data: maskData } = maskBuffer;

  for (let i = 0; i < baseData.length; i += 4) {
    const maskA = maskData[i + 3] ?? 255;
    if (maskA < 128) {
      baseData[i] = 255;
      baseData[i + 1] = 0;
      baseData[i + 2] = 0;
    }
  }

  return sharp(baseData, { raw: { width, height, channels: 4 } }).png().toBuffer();
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

/** Gemini API (Nano Banana) — markup image + reference image + prompt. Uses API key auth. */
async function runGeminiNanoBananaInpaint(
  geminiApiKey: string,
  inputImageUrl: string,
  maskInput: string,
  editPrompt: string,
  referenceImageUrl: string | null
): Promise<string> {
  const dims = await getImageDimensions(inputImageUrl);
  const markupBuffer = await createMarkupImage(inputImageUrl, maskInput, dims.w, dims.h);
  const markupB64 = markupBuffer.toString('base64');

  const refConstraint =
    'The reference image may contain multiple materials. Use ONLY the specific material the user names (e.g. brick, stucco). Ignore all other materials. ';
  const maskInstruction =
    'Edit ONLY the red marked areas. Do not modify any other parts of the image. ';
  const prompt = referenceImageUrl
    ? `${refConstraint}Apply the material and style from the second reference image to the red marked areas only. ${maskInstruction}${editPrompt}`
    : `${maskInstruction}${editPrompt}`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    { inlineData: { mimeType: 'image/png', data: markupB64 } },
  ];
  if (referenceImageUrl?.trim()) {
    const refBuffer = await resolveMaskToBuffer(referenceImageUrl.trim());
    parts.push({ inlineData: { mimeType: 'image/png', data: refBuffer.toString('base64') } });
  }

  const url = `${GEMINI_IMAGE_URL}?key=${encodeURIComponent(geminiApiKey)}`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  const partsOut = data?.candidates?.[0]?.content?.parts;
  const imgPart = partsOut?.find((p) => p.inlineData?.data);
  const b64 = imgPart?.inlineData?.data;
  if (!b64) throw new Error('No image in Gemini response');

  return `data:image/png;base64,${b64}`;
}

export async function processJob(
  openaiKey: string,
  geminiApiKey: string | undefined,
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

  const maskedBackend = geminiApiKey ? 'Gemini (Nano Banana)' : 'none';
  console.log(
    `[processJob] project=${projectId} hasMask=${hasMask} maskRegions=${maskRegions.length} maskImageUrl=${!!maskImageUrl} → ${hasMask ? maskedBackend : 'OpenAI'}`
  );

  const baseUrl =
    rawInputImageUrl && typeof rawInputImageUrl === 'string' && rawInputImageUrl.trim().length > 0
      ? rawInputImageUrl.trim()
      : baseImageUrl;

  let lastResultB64: string;

  if (hasMask) {
    const maskUrl = maskImageUrl?.trim() ?? maskRegions[0]?.mask ?? null;
    if (!maskUrl) throw new Error('Mask required for masked edit');

    if (!geminiApiKey) {
      throw new Error(
        'GEMINI_API_KEY required for masked edits. Add it to Railway variables. Get one at https://aistudio.google.com/app/apikey'
      );
    }

    const runMasked = async (
      imgUrl: string,
      mask: string,
      fullPrompt: string,
      refUrl: string | null
    ): Promise<string> => {
      return runGeminiNanoBananaInpaint(geminiApiKey!, imgUrl, mask, fullPrompt, refUrl);
    };

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
        const dataUrl = await runMasked(currentImageUrl, region.mask, regionPrompt, refUrl);
        currentImageUrl = dataUrl;
      }
      lastResultB64 = currentImageUrl.replace(/^data:image\/\w+;base64,/, '');
    } else {
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
      const dataUrl = await runMasked(baseUrl, maskUrl, fullPrompt, refUrl);
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
