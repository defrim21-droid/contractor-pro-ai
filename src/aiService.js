import { supabase } from './supabaseClient';

/**
 * Save project: upload original image and swatches to storage; create or update project in DB.
 * No masking. Returns the saved project.
 */
export const processAiRenovation = async (
  userId,
  projectName,
  projectAddress,
  imageFile,
  _canvasRef,
  _history,
  swatches,
  customPrompt,
  existingProjectId = null,
  clientEmail = null,
) => {
  try {
    const timestamp = Date.now();
    let originalUrl;

    if (imageFile instanceof File) {
      const fileExt = imageFile.name.split('.').pop();
      const mainPath = `uploads/${userId}/${timestamp}-original.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('project-images-public').upload(mainPath, imageFile);
      if (uploadError) throw uploadError;
      originalUrl = supabase.storage.from('project-images-public').getPublicUrl(mainPath).data.publicUrl;
    } else if (typeof imageFile === 'string') {
      originalUrl = imageFile;
    } else {
      throw new Error('Invalid image file: must be a File object or URL string');
    }

    const swatchData = [];
    for (let i = 0; i < swatches.length; i++) {
      const s = swatches[i];
      const sPath = `uploads/${userId}/${timestamp}-sample-${s.id}.png`;
      await supabase.storage.from('project-images-public').upload(sPath, s.file);
      const sUrl = supabase.storage.from('project-images-public').getPublicUrl(sPath).data.publicUrl;
      swatchData.push({ id: s.id, name: (s.name || '').trim() || `Sample ${i + 1}`, color: s.color, url: sUrl });
    }

    const hasNewOriginalFile = imageFile instanceof File;
    const updatePayload = {
      name: projectName,
      address: projectAddress,
      ...(clientEmail !== undefined && { client_email: clientEmail || null }),
      mask_url: null,
      swatch_data: swatchData,
      status: 'draft',
    };
    if (hasNewOriginalFile) updatePayload.original_image_url = originalUrl;

    let dbData;
    if (existingProjectId) {
      const { data, error: dbError } = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', existingProjectId)
        .select()
        .single();
      if (dbError) throw dbError;
      dbData = data;
    } else {
      const { data, error: dbError } = await supabase
        .from('projects')
        .insert([{
          user_id: userId,
          name: projectName,
          address: projectAddress,
          client_email: clientEmail || null,
          original_image_url: originalUrl,
          mask_url: null,
          swatch_data: swatchData,
          status: 'draft',
        }])
        .select()
        .single();
      if (dbError) throw dbError;
      dbData = data;
    }

    return dbData;
  } catch (err) {
    console.error('Project save error:', err);
    throw err;
  }
};
