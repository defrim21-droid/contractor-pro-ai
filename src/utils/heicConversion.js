/**
 * Convert HEIC/HEIF files to JPEG for compatibility with OpenAI API and browser display.
 * Returns the original file if not HEIC or if conversion fails.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function convertHeicToJpegIfNeeded(file) {
  const name = (file.name || '').toLowerCase();
  if (!name.endsWith('.heic') && !name.endsWith('.heif')) {
    return file;
  }
  try {
    const heic2any = (await import('heic2any')).default;
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('HEIC conversion failed, using original file:', err);
    return file;
  }
}
