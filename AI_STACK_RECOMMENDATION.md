# AI Stack Recommendation for Material Application

## Your Requirements
- Apply swatches (material textures) to highlighted areas
- Hyperrealistic results
- Preserve rest of image exactly
- Use color-coded masks to map swatches to areas
- Already have Replicate account ✅

## Recommended Stack (Replicate)

### Primary Model: SDXL Inpainting + IP-Adapter

**Best Option**: `stability-ai/sdxl-inpainting` + `lucataco/ip-adapter-plus-face` or custom IP-Adapter

**Why**:
- SDXL produces high-quality, realistic results
- Inpainting preserves unmasked areas perfectly
- IP-Adapter allows you to use swatch images as style references
- Can combine multiple swatches in one generation

### Alternative: ControlNet Inpainting

**Model**: `lucataco/controlnet-inpaint` or `fofr/controlnet-inpaint`

**Why**:
- Better control over the inpainted area
- Can use depth/edge maps for better structure preservation
- Good for maintaining architectural details

### For Hyperrealistic Results: Add Upscaling

**Model**: `nightmareai/real-esrgan` or `lucataco/real-esrgan`

**Why**:
- Upscales final result to higher resolution
- Enhances realism and detail
- Can be applied as post-processing step

## Recommended Architecture

### Option 1: Single-Pass with IP-Adapter (Recommended)

**Flow**:
1. Process color-coded mask → Extract individual masks per swatch
2. For each swatch area:
   - Use SDXL Inpainting with IP-Adapter
   - Use swatch image as style reference
   - Mask only the specific area
3. Composite all results back together
4. Upscale final image

**Models**:
- `stability-ai/sdxl-inpainting` (base)
- `lucataco/ip-adapter-plus` (for style transfer)
- `nightmareai/real-esrgan` (upscaling)

### Option 2: Multi-Pass Sequential Inpainting

**Flow**:
1. Process mask to identify each color region
2. For each swatch (in order):
   - Create binary mask for that color
   - Run inpainting with swatch as reference
   - Composite result back
3. Final upscale

**Models**:
- `stability-ai/stable-diffusion-inpainting` (simpler, faster)
- `nightmareai/real-esrgan` (upscaling)

## Implementation Strategy

### Step 1: Process Color-Coded Mask

Your current mask has different colors for different swatches. You need to:
1. Extract individual binary masks for each color
2. Map each mask to its corresponding swatch

### Step 2: Generate for Each Swatch Area

For each swatch + mask combination:
- Input: Original image + binary mask + swatch image
- Model: SDXL Inpainting with IP-Adapter
- Prompt: "realistic [material type] texture, high quality, photorealistic"
- Output: Inpainted area

### Step 3: Composite Results

- Layer all inpainted areas back onto original image
- Ensure seamless blending at edges
- Preserve unmasked areas exactly

### Step 4: Post-Process

- Upscale with Real-ESRGAN
- Optional: Color correction, lighting adjustment

## Specific Replicate Models

### 1. SDXL Inpainting (Primary)
```
Model: stability-ai/sdxl-inpainting
Inputs:
  - image: Original photo
  - mask: Binary mask (white = inpaint area)
  - prompt: "realistic [material] texture, photorealistic, high detail"
  - negative_prompt: "blurry, distorted, unrealistic"
  - num_inference_steps: 30-50 (higher = better quality)
  - guidance_scale: 7.5-12
```

### 2. IP-Adapter for Style Transfer
```
Model: lucataco/ip-adapter-plus
Inputs:
  - image: Original photo
  - ip_adapter_image: Swatch image (the material texture)
  - mask: Binary mask
  - prompt: "apply this material texture realistically"
```

### 3. Real-ESRGAN for Upscaling
```
Model: nightmareai/real-esrgan
Inputs:
  - image: Final composited image
  - scale: 2 or 4 (2x or 4x upscale)
```

## Edge Function Implementation

Create `supabase/functions/generate-renovation/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')
const REPLICATE_API_URL = 'https://api.replicate.com/v1'

serve(async (req) => {
  try {
    const { projectId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Fetch project data
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (fetchError || !project) throw fetchError

    // Download images
    const originalImage = await downloadImage(project.original_image_url)
    const maskImage = await downloadImage(project.mask_url)
    const swatches = project.swatch_data || []

    // Process color-coded mask into individual masks
    const individualMasks = extractColorMasks(maskImage, swatches)

    // Generate for each swatch area
    let resultImage = originalImage
    for (const { mask, swatch } of individualMasks) {
      const inpainted = await inpaintWithSwatch(
        resultImage,
        mask,
        swatch.url,
        swatch.materialType || 'material'
      )
      resultImage = compositeImages(resultImage, inpainted, mask)
    }

    // Upscale final result
    const upscaled = await upscaleImage(resultImage)

    // Upload result
    const resultUrl = await uploadToSupabase(upscaled, projectId)

    // Update project
    await supabase
      .from('projects')
      .update({
        generated_image_url: resultUrl,
        status: 'completed'
      })
      .eq('id', projectId)

    return new Response(
      JSON.stringify({ success: true, imageUrl: resultUrl }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function inpaintWithSwatch(image, mask, swatchUrl, materialType) {
  const response = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'stability-ai/sdxl-inpainting:latest',
      input: {
        image: image,
        mask: mask,
        prompt: `realistic ${materialType} texture, photorealistic, high quality, seamless integration`,
        negative_prompt: 'blurry, distorted, unrealistic, cartoon, painting',
        num_inference_steps: 40,
        guidance_scale: 9,
        strength: 0.9,
      }
    })
  })

  const prediction = await response.json()
  return await pollForResult(prediction.id)
}

async function upscaleImage(image) {
  const response = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'nightmareai/real-esrgan:latest',
      input: {
        image: image,
        scale: 2
      }
    })
  })

  const prediction = await response.json()
  return await pollForResult(prediction.id)
}

async function pollForResult(predictionId) {
  // Poll until prediction completes
  while (true) {
    const response = await fetch(
      `${REPLICATE_API_URL}/predictions/${predictionId}`,
      {
        headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
      }
    )
    const prediction = await response.json()
    
    if (prediction.status === 'succeeded') {
      return prediction.output
    }
    if (prediction.status === 'failed') {
      throw new Error('Prediction failed')
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
```

## Cost Estimation (Replicate)

- **SDXL Inpainting**: ~$0.004-0.008 per generation
- **Real-ESRGAN**: ~$0.002 per upscale
- **Total per rendering**: ~$0.006-0.010

For 100 renderings/month: ~$0.60-1.00

## Alternative: Simpler Single Model Approach

If you want to start simpler:

**Model**: `stability-ai/stable-diffusion-inpainting`

- Faster and cheaper
- Good quality (not as hyperrealistic as SDXL)
- Easier to implement
- Can upgrade to SDXL later

## Recommended Starting Point

1. **Start Simple**: Use `stability-ai/stable-diffusion-inpainting`
   - Test with single swatch + mask
   - Verify quality meets your needs

2. **Upgrade if Needed**: Move to SDXL Inpainting
   - Better quality
   - More control

3. **Add Upscaling**: Use Real-ESRGAN
   - For final polish
   - Higher resolution output

4. **Optimize**: Add IP-Adapter if needed
   - Better material transfer
   - More accurate swatch application

## Key Considerations

### Mask Processing
- Your color-coded mask needs to be converted to binary masks
- Each color → one binary mask → one swatch
- Process sequentially or in parallel

### Prompt Engineering
- Use descriptive prompts: "realistic [material] texture"
- Include: "photorealistic", "seamless", "high quality"
- Negative prompts: "blurry", "distorted", "unrealistic"

### Quality vs Speed
- More inference steps = better quality but slower
- SDXL = better quality but more expensive
- Balance based on your needs

## Next Steps

1. Test with `stability-ai/stable-diffusion-inpainting` first
2. Create Edge Function to process masks and call Replicate
3. Test with one swatch + mask combination
4. Scale up to multiple swatches
5. Add upscaling if needed

Would you like me to create the Edge Function implementation?
