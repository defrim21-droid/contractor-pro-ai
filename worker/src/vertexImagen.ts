/**
 * Vertex AI Imagen API utility for localized material substitution (inpainting).
 * Uses imagen-3.0-capability-001 with editMode: inpainting-insert.
 * Maintains exact output dimensions via sharp padding/crop.
 */
import sharp from 'sharp';
import { GoogleAuth } from 'google-auth-library';

const IMAGEN_MODEL = 'imagen-3.0-capability-001';
const EDIT_MODE = 'EDIT_MODE_INPAINT_INSERTION';
/** 0 = strict mask boundary; higher values dilate (expand) the edit area. */
const MASK_DILATION = 0;
/** Edit API default for insert mode; higher = stronger adherence to prompt and style. */
const GUIDANCE_SCALE = 60;
/** Higher steps = better quality. Vertex recommends 35–75 for insert mode. */
const BASE_STEPS = 55;

/** Max dimension to stay under Vertex image size limit (~27M chars base64). */
const MAX_IMAGE_DIMENSION = 1024;

export interface VertexImagenInput {
  baseImageUrl: string;
  maskImageUrl: string;
  referenceSwatchUrl: string | null;
  userPrompt: string;
  projectId: string;
  location?: string;
}

/**
 * Resolve image URL or data URL to buffer.
 */
async function resolveToBuffer(input: string): Promise<Buffer> {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    const resp = await fetch(input);
    return Buffer.from(await resp.arrayBuffer());
  }
  const base64 = input.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/**
 * Convert our mask format (transparent = edit) to Vertex format (non-zero = edit).
 * Vertex expects: non-zero pixels = edit area, zero = keep.
 */
async function convertMaskForVertex(maskBuffer: Buffer, w: number, h: number): Promise<Buffer> {
  const { data } = await sharp(maskBuffer)
    .resize(w, h)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 255;
    const isEdit = a < 128;
    out[i] = isEdit ? 255 : 0;
    out[i + 1] = isEdit ? 255 : 0;
    out[i + 2] = isEdit ? 255 : 0;
    out[i + 3] = 255;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/**
 * Resize image to fit within MAX_IMAGE_DIMENSION, pad to square for Vertex. Preserves aspect ratio.
 */
async function resizeAndPadForVertex(buffer: Buffer): Promise<{
  paddedBuffer: Buffer;
  originalW: number;
  originalH: number;
  paddedW: number;
  paddedH: number;
  cropLeft: number;
  cropTop: number;
}> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w <= 0 || h <= 0) throw new Error('Invalid image dimensions');

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(w, h));
  const resizedW = Math.round(w * scale);
  const resizedH = Math.round(h * scale);
  const resized = await sharp(buffer).resize(resizedW, resizedH).png().toBuffer();

  const side = Math.max(resizedW, resizedH, MAX_IMAGE_DIMENSION);
  const paddedW = Math.min(side, MAX_IMAGE_DIMENSION);
  const paddedH = paddedW;
  const padW = Math.max(0, paddedW - resizedW);
  const padH = Math.max(0, paddedH - resizedH);
  const left = Math.floor(padW / 2);
  const top = Math.floor(padH / 2);

  const padded = await sharp(resized)
    .extend({
      top,
      bottom: padH - top,
      left,
      right: padW - left,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();

  return {
    paddedBuffer: padded,
    originalW: w,
    originalH: h,
    paddedW,
    paddedH,
    cropLeft: left,
    cropTop: top,
  };
}

/**
 * Build the prompt wrapper around user input.
 */
function buildPromptWrapper(userPrompt: string, hasStyleRef: boolean): string {
  const stylePart = hasStyleRef
    ? 'Apply the material and surface appearance from reference image [3] to the masked area only. Photorealistic, natural lighting, seamless integration. '
    : '';
  return (
    stylePart +
    'Strictly confine all changes to the masked region only. Do not modify pixels outside the mask. ' +
    'Keep the underlying geometry; change only color and surface texture. ' +
    `User instruction: ${userPrompt.trim()}`
  );
}

const NEGATIVE_PROMPT =
  'blurry, low quality, cartoon, artificial, fake texture, oversaturated, unnatural, soft edges, halos, bleeding outside mask';

/**
 * Get Google Cloud access token for Vertex AI.
 */
async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Failed to obtain Google Cloud access token');
  return token.token;
}

/**
 * Call Vertex AI Imagen API for inpainting.
 * Pads base/mask to preferred size if needed, crops result back to original dimensions.
 */
export async function runVertexImagenInpaint(input: VertexImagenInput): Promise<string> {
  const location = input.location || 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${input.projectId}/locations/${location}/publishers/google/models/${IMAGEN_MODEL}:predict`;

  const [baseBuf, maskBuf, refBuf] = await Promise.all([
    resolveToBuffer(input.baseImageUrl),
    resolveToBuffer(input.maskImageUrl),
    input.referenceSwatchUrl ? resolveToBuffer(input.referenceSwatchUrl) : Promise.resolve(null),
  ]);

  const {
    paddedBuffer: paddedBase,
    originalW,
    originalH,
    paddedW,
    paddedH,
    cropLeft,
    cropTop,
  } = await resizeAndPadForVertex(baseBuf);

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(originalW, originalH));
  const resizedW = Math.round(originalW * scale);
  const resizedH = Math.round(originalH * scale);
  const maskAtOrig = await convertMaskForVertex(maskBuf, resizedW, resizedH);
  const padW = paddedW - resizedW;
  const padH = paddedH - resizedH;
  const left = Math.floor(padW / 2);
  const top = Math.floor(padH / 2);
  const paddedMask =
    padW > 0 || padH > 0
      ? await sharp(maskAtOrig)
          .extend({
            top,
            bottom: padH - top,
            left,
            right: padW - left,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          })
          .png()
          .toBuffer()
      : maskAtOrig;

  const paddedRef = refBuf
    ? await sharp(refBuf).resize(paddedW, paddedH).png().toBuffer()
    : null;

  const baseB64 = paddedBase.toString('base64');
  const maskB64 = paddedMask.toString('base64');

  const referenceImages: Record<string, unknown>[] = [
    {
      referenceType: 'REFERENCE_TYPE_RAW',
      referenceId: 1,
      referenceImage: { bytesBase64Encoded: baseB64 },
    },
    {
      referenceType: 'REFERENCE_TYPE_MASK',
      referenceId: 2,
      referenceImage: { bytesBase64Encoded: maskB64 },
      maskImageConfig: {
        maskMode: 'MASK_MODE_USER_PROVIDED',
        dilation: MASK_DILATION,
      },
    },
  ];

  if (paddedRef) {
    referenceImages.push({
      referenceType: 'REFERENCE_TYPE_STYLE',
      referenceId: 3,
      referenceImage: { bytesBase64Encoded: paddedRef.toString('base64') },
      styleImageConfig: {
        styleDescription: 'material texture, color, and surface appearance',
      },
    });
  }

  const prompt = buildPromptWrapper(input.userPrompt, !!paddedRef);
  console.log(`[Vertex] refs=${referenceImages.length} hasStyleRef=${!!paddedRef} promptLen=${prompt.length}`);

  const body = {
    instances: [
      {
        prompt,
        referenceImages,
      },
    ],
    parameters: {
      editMode: EDIT_MODE,
      editConfig: { baseSteps: BASE_STEPS },
      guidanceScale: GUIDANCE_SCALE,
      negativePrompt: NEGATIVE_PROMPT,
      sampleCount: 1,
    },
  };

  const token = await getAccessToken();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let details = '';
    try {
      const errJson = JSON.parse(errText) as { error?: { message?: string; details?: unknown[] } };
      details = errJson.error?.message ?? '';
      if (errJson.error?.details?.length) {
        details += ` ${JSON.stringify(errJson.error.details)}`;
      }
    } catch {
      details = errText;
    }
    throw new Error(`Vertex Imagen API failed: ${res.status} ${details || errText}`);
  }

  const data = (await res.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string }>;
  };
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('No image in Vertex Imagen response');

  const resultBuffer = Buffer.from(b64, 'base64');

  const cropped = await sharp(resultBuffer)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: resizedW,
      height: resizedH,
    })
    .png()
    .toBuffer();

  const final =
    resizedW === originalW && resizedH === originalH
      ? cropped
      : await sharp(cropped).resize(originalW, originalH).png().toBuffer();

  return `data:image/png;base64,${final.toString('base64')}`;
}
