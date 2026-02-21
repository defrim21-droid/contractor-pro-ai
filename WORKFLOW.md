# Swatch → Render workflow

Step-by-step flow from your action to the final image, and where to look when something goes wrong.

---

## What you do in the app (in order)

### 1. Create or open a project
- Enter **Project name** (required).
- Optionally enter **Address**.

### 2. Upload the house photo
- Use the photo upload for the main image.
- Wait until the image is fully loaded (canvas and zoom appear).

### 3. Add at least one swatch
- Upload one or more **swatch** images (the material/finish you want, e.g. brick, siding).
- Each swatch gets a color chip; one is “active” for drawing.

### 4. Draw the mask (required when using swatches)
- Switch to draw mode (polygon or brush).
- **Polygon:** click points around the area (e.g. the wall), then click **“Close polygon”** so the shape fills. If you don’t close it, the mask is empty and generation will fail or upscale-only.
- **Brush:** paint over the area.
- The mask must **overlap** the active swatch’s color so the backend gets a binary mask per swatch.

### 5. Click **Render**
- The **Render** button is only enabled when you have a mask (and swatches). If you have swatches but no mask, the button is disabled and you’ll get a toast to draw a mask first.

---

## What happens under the hood

### Client (browser)

1. **Upload assets**
   - Original photo → `project-images` storage → `original_image_url`.
   - Mask canvas → PNG blob → `mask.png` → `mask_url`.
   - For each swatch: file → `swatch-{id}.png`, and a **binary mask** (where that swatch’s color is drawn) → `mask-binary-{id}.png` → `swatch_data[].url` and `swatch_data[].mask_url`.

2. **Save project**
   - Row in `projects` with `original_image_url`, `mask_url`, `swatch_data`, `status: 'processing'`.

3. **Call Edge Function**
   - `supabase.functions.invoke('generate-renovation', { body: { projectId: dbData.id } })`.
   - Waits for the function to finish, then refetches the project and returns (so the UI shows the new `generated_image_url`).

### When you have mask + swatches (main flow)

Rendering is done **entirely in the browser** (no Edge Function for the material):

1. **Client** tiles the **actual swatch image** inside the masked area (same product the contractor uploaded).
2. **Overlay preservation** keeps lights/fixtures from the original on top of the texture where they’re bright.
3. **Upload** the composited image and set it as the project’s generated image.
4. **No resize** – output is the same dimensions as the original. Everything outside the mask is unchanged.

So you see the **exact product** on the house, not an AI-generated approximation.

### Edge Function (`generate-renovation`) – only when there is no mask

Used only for the “no mask” case (e.g. “improve this photo”):

1. **Load project** and **original image**.
2. **Upscale** the original with Real-ESRGAN.
3. **Upload** result to storage and **update project** (`generated_image_url`, `status: 'completed'`).

---

## Checklist when “it’s not working”

### In the UI
- [ ] **Project name** is filled.
- [ ] **Photo** is uploaded and fully loaded (no “wait for image” state).
- [ ] At least **one swatch** is added.
- [ ] You **drew a mask** (polygon **closed** or brush strokes) over the area you want to change.
- [ ] **Render** is enabled (not disabled/greyed). If it’s disabled, the app thinks there’s no valid mask.

### In the browser (DevTools)
- **Console:** with mask + swatch you should not see an Edge Function request for the material – rendering is client-side. If something fails, look for "Composite error" or upload errors.
- **Network:** when you have a mask, the client uploads the composited image directly to storage; `generate-renovation` is only called when there is no mask (upscale).

### In Supabase
- **Table Editor → `projects`:** for that project, confirm:
  - `original_image_url` and `mask_url` are set.
  - `swatch_data` is an array; each entry has `url` (swatch image) and `mask_url` (binary mask). If `mask_url` is null for a swatch, that swatch’s mask wasn’t generated (mask didn’t use that swatch’s color).
- **Storage → `project-images`:** you should see:
  - `uploads/...` (original, mask, swatches, mask-binary-*).
  - `renders/...` after a successful run.

### Edge Function logs (Supabase Dashboard)
- **Edge Functions → generate-renovation → Logs.**
- Look for:
  - “Downloading swatch image”, “OpenAI swatch description: …” or “LLaVA swatch description: …”, “Inpainting with prompt: …” → describe + inpaint ran.
  - “Swatch description failed, using fallback” → vision API failed; inpainting still runs with a generic prompt.
  - “Error processing swatch …” → that swatch failed (e.g. Replicate error); next swatch may still run.
  - “Failed to download …” → check storage URLs and bucket policy (public read for those paths).

### Secrets
- **Mask + swatch path:** No Edge Function is used for the material, so no OpenAI/Replicate needed for that flow.
- **No-mask path (upscale):** `REPLICATE_API_TOKEN` is required for the Edge Function.

---

## Quick reference: one run (mask + one swatch)

| Step | Who | What |
|------|-----|------|
| 1 | You | Upload photo, add swatch, draw mask, close polygon, click Render |
| 2 | Client | Upload photo, mask, swatch, binary mask; save project |
| 3 | Client | Composite: tile the **actual swatch** in the mask on the original (same dimensions) |
| 4 | Client | Overlay preservation (keep lights/fixtures on top where bright) |
| 5 | Client | Upload composited image to storage; set `generated_image_url`, `status: 'completed'` |
| 6 | UI | Shows the render (exact product on the house) |

If composite or upload fails, the project is set to `status: 'failed'` and the error is shown.
