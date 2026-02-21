/**
 * Frontend mask processing utilities
 * Process color-coded masks into binary masks before sending to backend
 */

const MASK_MAX_DIMENSION = 1024;

/**
 * Resize canvas to fit within max dimension while keeping aspect ratio.
 * Reduces payload size for Edge Function request limits.
 */
function resizeMaskIfNeeded(canvas) {
  const { width: w, height: h } = canvas;
  if (w <= MASK_MAX_DIMENSION && h <= MASK_MAX_DIMENSION) return canvas;
  const scale = MASK_MAX_DIMENSION / Math.max(w, h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const out = document.createElement('canvas');
  out.width = nw;
  out.height = nh;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0, w, h, 0, 0, nw, nh);
  return out;
}

/**
 * Get image dimensions from URL (matches what backend/OpenAI will receive)
 * @param {string} url
 * @returns {Promise<{ w: number, h: number }>}
 */
export function getImageDimensionsFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Create a PNG mask for OpenAI Image Edits (transparent = area to edit).
 * Scales brush canvas from display size to image natural size.
 * @param {HTMLCanvasElement} brushCanvas - Canvas with brush strokes (any visible pixels = edit)
 * @param {{ w: number, h: number }} naturalSize - Original image dimensions
 * @returns {Promise<string>} Data URL of the mask PNG
 */
export function createEditMaskFromBrushCanvas(brushCanvas, naturalSize) {
  return new Promise((resolve) => {
    const out = document.createElement('canvas');
    out.width = naturalSize.w;
    out.height = naturalSize.h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = 'rgba(0,0,0,255)';
    ctx.fillRect(0, 0, naturalSize.w, naturalSize.h);
    ctx.drawImage(brushCanvas, 0, 0, brushCanvas.width, brushCanvas.height, 0, 0, naturalSize.w, naturalSize.h);
    const data = ctx.getImageData(0, 0, naturalSize.w, naturalSize.h);
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      if (r > 10 || g > 10 || b > 10) {
        data.data[i] = 0;
        data.data[i + 1] = 0;
        data.data[i + 2] = 0;
        data.data[i + 3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);
    resolve(out.toDataURL('image/png'));
  });
}

/**
 * Create an OpenAI-format mask for one color (transparent = edit that region).
 * Used when user paints different regions with different colors (Sample 1=red, Sample 2=green, etc.)
 * @param {HTMLCanvasElement} brushCanvas - Canvas with color-coded brush strokes
 * @param {{ w: number, h: number }} naturalSize - Image natural dimensions
 * @param {string} targetColor - Hex color to extract (e.g. '#ef4444')
 * @returns {Promise<string>} Data URL of the mask PNG
 */
export function createEditMaskForColor(brushCanvas, naturalSize, targetColor) {
  return new Promise((resolve) => {
    const hex = targetColor.replace('#', '');
    const targetR = parseInt(hex.substring(0, 2), 16);
    const targetG = parseInt(hex.substring(2, 4), 16);
    const targetB = parseInt(hex.substring(4, 6), 16);
    const tolerance = 40;

    const out = document.createElement('canvas');
    out.width = naturalSize.w;
    out.height = naturalSize.h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(brushCanvas, 0, 0, brushCanvas.width, brushCanvas.height, 0, 0, naturalSize.w, naturalSize.h);
    const data = ctx.getImageData(0, 0, naturalSize.w, naturalSize.h);

    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      const matches =
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance;
      if (matches) {
        data.data[i] = 0;
        data.data[i + 1] = 0;
        data.data[i + 2] = 0;
        data.data[i + 3] = 0;
      } else {
        data.data[i] = 0;
        data.data[i + 1] = 0;
        data.data[i + 2] = 0;
        data.data[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    resolve(out.toDataURL('image/png'));
  });
}

/**
 * Get which swatch colors have strokes on the brush canvas
 * @param {HTMLCanvasElement} canvas
 * @param {Array} swatches - swatch objects with color
 * @returns {Array} Indices of swatches that have strokes
 */
export function getColorsWithStrokes(canvas, swatches) {
  if (!canvas || canvas.width === 0 || canvas.height === 0 || !swatches.length) return [];
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const found = [];
  const tolerance = 40;
  for (let s = 0; s < swatches.length; s++) {
    const c = swatches[s].color;
    if (!c) continue;
    const hex = c.replace('#', '');
    const tr = parseInt(hex.substring(0, 2), 16);
    const tg = parseInt(hex.substring(2, 4), 16);
    const tb = parseInt(hex.substring(4, 6), 16);
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - tr) <= tolerance && Math.abs(data[i + 1] - tg) <= tolerance && Math.abs(data[i + 2] - tb) <= tolerance) {
        found.push(s);
        break;
      }
    }
  }
  return found;
}
