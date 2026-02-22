# AI Stack Audit & 2026 Replacement Plan

**Principal ML Architect – Computer Vision & Photorealistic Rendering**  
**Document type:** Technical replacement plan (no implementation).  
**Constraints:** Production-deployable, GPU-accelerated, geometry-preserving, modular, not purely generative.

---

## 1. Audit of Current AI Stack

### 1.1 All Models Used

| Model | Provider | Version / ID | Purpose |
|-------|----------|-------------|---------|
| **Stable Diffusion Inpainting** | Replicate (Stability AI) | `stability-ai/stable-diffusion-inpainting:95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3` | Text-guided inpainting in mask (material from prompt); also used for “harmonize” pass (low strength). |
| **Real-ESRGAN** | Replicate (nightmareai) | `nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf68f3` | 2× super-resolution (no-mask path; optional after harmonize). |
| **GPT-4o-mini (vision)** | OpenAI | `gpt-4o-mini` | Swatch image → short text description for inpainting prompt (when `OPENAI_API_KEY` set). |
| **LLaVA-13B** | Replicate (yorickvp) | `yorickvp/llava-13b:e272157381e2a3bf12df3a8edd1f38d1dbd736bbb7437277c8b34175f8fce358` | Fallback for swatch → text description when OpenAI not used. |

**Client-side (no external ML):**

- **Texture composite:** Canvas 2D tiling of swatch image in mask (repeat pattern, scale from mask-coverage heuristic).
- **Mask processing:** Color-coded canvas → per-swatch binary masks (exact RGB match, alpha > 128).
- **Overlay preservation:** Luminance threshold (≥200) to keep original pixels (e.g. lights) on top of texture.
- **Preserve unmasked:** Optional composite of original + AI result using mask (used when AI path was active).

### 1.2 All Inference Paths

1. **Mask + swatch (primary production path)**  
   - **Client only.** No Edge Function. No vision/inpainting/upscale.  
   - Flow: Upload assets → DB → `compositeSwatchOntoImage` (tile swatch in mask) → `applyOverlayPreservation` → upload PNG → done.  
   - Preprocessing: Canvas → color mask PNG; per-swatch binary mask blobs.  
   - Postprocessing: Merge mask blobs; overlay preservation (pixel loop); none for “AI”.

2. **No mask (optional upscale)**  
   - Edge Function: fetch project → download original → `upscaleImage(Real-ESRGAN, scale=2)` → upload → update project.  
   - Preprocessing: Image → base64 data URL for Replicate.  
   - Postprocessing: Poll prediction → fetch output image → base64.

3. **Edge Function “mask + swatch” path (dormant if client uses path 1)**  
   - If invoked with `projectId` and project has `mask_url` + `swatch_data`:  
     For each swatch: `describeSwatchForPrompt` (OpenAI or LLaVA) → `inpaintWithPrompt` (SD inpainting) → `compositeImages` (no-op; returns full inpainted image). No upscale.  
   - Preprocessing: Download image/mask/swatch → base64.  
   - Postprocessing: Poll per prediction; no true composite (unmasked areas are whatever the inpainting model left).

4. **Harmonize path (optional, when `harmonizeComposited` + `compositedImageUrl`)**  
   - Download composited image → `harmonizeWithInpainting` (SD inpainting, strength 0.5, blend prompt) → `upscaleImage` → upload.  
   - Preprocessing: Composited + mask as base64.  
   - Postprocessing: Poll; upload result.

### 1.3 Preprocessing Summary

- **Client:** Canvas dimensions from loaded image; color mask → binary masks (pixel loop, tolerance 0); no resizing, no depth/normal/segmentation.  
- **Edge Function:** Image/mask/swatch fetched from URLs → ArrayBuffer → base64 data URLs; no normalization, no crop, no depth or geometry.

### 1.4 Postprocessing Summary

- **Client:** Merge mask blobs (union); overlay preservation (luminance threshold); optional “preserve unmasked” composite when an AI result exists.  
- **Edge Function:** Poll Replicate until `succeeded`; fetch output image URL → blob → base64; `compositeImages` is a no-op (returns inpainted image as-is). No luminance transfer, no feathering, no geometry-aware blend.

---

## 2. Architectural Weaknesses

1. **No geometry or scene understanding**  
   - No segmentation (facade vs sky, trim, windows).  
   - No depth or surface normals → no perspective-correct or lighting-correct texture placement.  
   - Mask is purely user-drawn; no automatic surface or boundary refinement.

2. **Texture application is either flat or generative**  
   - **Client path:** Flat tiled overlay in screen space; no warp, no luminance multiply, no edge feathering → “sticker” look.  
   - **Server path:** Full diffusion inpainting from text; ignores actual swatch pixels; hallucinated texture, not deterministic product visualization.

3. **Lighting and shading not preserved**  
   - No extraction of facade luminance or albedo.  
   - No step that multiplies projected texture by original lighting or preserves shadows/highlights.  
   - Overlay preservation only handles very bright pixels (lights), not general shading.

4. **Scale and perspective**  
   - Tiling scale is a heuristic (mask coverage → repeat count); not tied to real-world scale or perspective.  
   - No homography or UV warp from “texture plane” to “facade in image”.

5. **Tight coupling and redundancy**  
   - Two competing strategies (client composite vs server describe+inpaint) with different quality and semantics.  
   - Harmonize path uses diffusion again (non-deterministic) and is separate from the main client path.

6. **No modular pipeline**  
   - Cannot swap “depth” or “normals” or “segmentation” without redesigning flows.  
   - No clear separation of: segment → estimate geometry → project texture → relight → optional refine.

7. **Reliance on generative inpainting for “material”**  
   - When server path is used, material is generated from text, not from the actual swatch image → not suitable for “this exact product on this house”.

---

## 3. Proposed 2026 Best-in-Class Stack (Replacement)

High-level pipeline (all steps deterministic except optional refinement):

1. **Exterior / surface segmentation** → which pixels belong to “facade” (or other semantic surfaces).  
2. **Depth estimation** → per-pixel or per-region depth.  
3. **Surface normal estimation** → from depth and/or direct normal prediction.  
4. **Texture projection** → warp and tile swatch using geometry (and optional scale prior).  
5. **Lighting preservation** → multiply/modulate projected texture by original luminance (and optionally shadows/highlights).  
6. **Edge feathering** → soft mask boundaries.  
7. **Optional diffusion refinement** → light-touch harmonization only at boundaries or low strength, not full re-generation of material.

Below: model choices, rationale, GPU memory, and latency. All assume single image input (no video); deployment target is GPU server or serverless GPU (e.g. Replicate, RunPod, or self-hosted).

---

### 3.1 Exterior / Surface Segmentation

**Role:** Segment building facade, sky, trim, windows, etc., so texture is applied only to relevant surfaces and boundaries are clean.

**Recommended model:** **OneFormer (CVPR 2023) or Segment Anything 2 (SAM 2)** for universal segmentation; optionally **Mask2Former** with an “exterior / building” dataset.

- **OneFormer** (e.g. `shi-labs/oneformer_ade20k_swin_large` or similar): Single model for semantic + instance; ADE20K includes “building”, “wall”, “house”. Good tradeoff quality/speed.  
- **Alternative:** **SAM 2** with box or point prompts derived from user mask (e.g. bounding box of drawn region) to get a refined, crisp mask.  
- **Why superior:** Explicit semantic surfaces; reduces “sticker” bleed onto sky/windows; enables per-surface rules (e.g. no texture on glass).  
- **GPU memory:** ~4–6 GB (Swin-L backbone).  
- **Latency:** ~0.3–0.8 s per image (resolution-dependent; e.g. 640–1024 px).

**Output:** Per-pixel semantic labels and/or binary “facade” mask (optionally combined with user mask).

---

### 3.2 Depth Estimation

**Role:** Metric or relative depth for the scene so texture can be warped with perspective and scale can be informed by distance.

**Recommended model:** **Depth Anything V2** or **MiDaS v3.1 (DPT-Large)** or **ZoeDepth** (NiN + metric head).

- **Depth Anything V2:** Trained on 62M images; strong zero-shot; single head for universal depth.  
- **MiDaS / DPT:** Industry standard; good generalization; ZoeDepth adds metric scale options.  
- **Why superior:** Single image → dense depth; no need for stereo or video; works for arbitrary photos.  
- **GPU memory:** ~4–8 GB (ViT-Large / DPT).  
- **Latency:** ~0.2–0.6 s for 512–1024 px.

**Output:** Depth map (H×W), same size as image; use for perspective warp and optional scale-from-depth.

---

### 3.3 Surface Normal Estimation

**Role:** Orient the texture to the surface (e.g. receding wall) and support lighting (e.g. Lambertian modulation).

**Recommended model:** **DSINE** or **GeoNet (normal from single image)** or **Omnidata (depth + normal from same encoder)**.

- **DSINE:** State-of-the-art single-image normals; good on indoor/outdoor.  
- **Omnidata:** Single model predicts both depth and normals; consistent geometry.  
- **Why superior:** Normals allow shading-aware compositing and less “flat” look; can drive simple lighting model.  
- **GPU memory:** ~4–6 GB.  
- **Latency:** ~0.2–0.5 s.

**Output:** Normal map (H×W×3); use for luminance modulation and optional warp.

**Alternative:** Derive normals from depth (gradient + optional smoothing) to avoid a second large model; slightly lower quality but one less GPU stage.

---

### 3.4 Texture Projection (Deterministic)

**Role:** Place the **actual swatch image** (not a generated texture) onto the facade with correct scale and warp; no diffusion here.

**Approach (no single “model”):** Algorithmic pipeline on GPU or CPU:

1. **Scale:** From depth + known or assumed brick/unit size, or from mask bounding box and a user/prior “repeats per meter” → repeats across image.  
2. **Warp:** Use depth (and optionally normals) to compute a per-pixel or quad-based warp (e.g. homography per facet, or UV from simple plane fit to masked depth).  
3. **Tile:** Sample from the swatch texture in UV space (or screen space with corrected UV); bilinear/trilinear to avoid aliasing.  
4. **Clamp extreme angles:** Where surface is nearly edge-on (e.g. normal pointing away), reduce texture strength or fade to original to avoid stretch artifacts.

**Why superior:** Uses the real product image; deterministic; geometry-aware; no hallucination.  
**GPU memory:** Minimal if implemented in shaders or small kernels; can run on same machine as depth/normal.  
**Latency:** ~10–50 ms for 1–2 MP image (depends on implementation).

---

### 3.5 Lighting Preservation

**Role:** Make the pasted texture follow the original image’s lighting (shadows, highlights, ambient).

**Approach:**

1. **Luminance map:** From original image in masked region: `L = 0.299*R + 0.587*G + 0.114*B` (or in linear space if available).  
2. **Albedo-style modulation:** Option A: `result = (texture * L_orig) / L_neutral` where `L_neutral` is mean or mid-gray. Option B: Transfer only shading (e.g. ratio of original to a smoothed version) onto the texture.  
3. **Shadows/highlights:** Optional: segment soft shadow vs lit regions (e.g. from luminance histogram or simple classifier) and preserve or slightly dampen texture in shadow.

**Why superior:** Keeps facades “in the scene” instead of a flat overlay.  
**GPU memory:** Negligible (pixel ops).  
**Latency:** &lt;50 ms.

---

### 3.6 Edge Feathering at Mask Boundaries

**Role:** Soft blend at mask edges so no hard cut.

**Approach:** Compute signed distance or gradient from mask boundary; apply smooth alpha (e.g. 1 – smoothstep) over 2–10 px; composite `result = alpha*texture + (1-alpha)*original` at boundaries.

**Why superior:** Removes visible “sticker” edge.  
**GPU memory / latency:** Negligible.

---

### 3.7 Optional Diffusion Refinement

**Role:** Only to hide seam or harmonize **only at the boundary** (or very low strength over mask), not to re-draw the material.

**Recommended:** **Lightweight inpainting or “boundary harmonization”** with:

- **Stable Diffusion Inpainting** or **LaMa** or **ProPainter-style** inpainting, restricted to a **narrow band** (e.g. 5–15 px) at the mask boundary, prompt: “seamless blend, match lighting”.  
- Or a dedicated **image harmonization** model (e.g. iHarmony4-style) if available in your deployment (Replicate, etc.).

**Why keep optional:** Deterministic projection already does the heavy lifting; diffusion only fixes residual seam.  
**GPU memory:** Same as current SD inpainting (~6–10 GB).  
**Latency:** ~3–10 s depending on resolution and strength.

---

## 4. Summary Table: Proposed Stack

| Component | Suggested model / method | Why superior | GPU memory (approx) | Latency (approx) |
|-----------|---------------------------|-------------|----------------------|-------------------|
| Exterior segmentation | OneFormer (ADE20K) or SAM 2 | Semantic surfaces; clean facade mask | 4–6 GB | 0.3–0.8 s |
| Depth | Depth Anything V2 or MiDaS/DPT or ZoeDepth | Dense depth for warp and scale | 4–8 GB | 0.2–0.6 s |
| Normals | DSINE or Omnidata (or from depth) | Surface orientation for lighting/warp | 4–6 GB | 0.2–0.5 s |
| Texture projection | Deterministic (warp + tile + scale) | Real swatch; no hallucination; geometry-aware | Small | 10–50 ms |
| Lighting preservation | Luminance transfer (algebraic) | Preserves shadows/highlights | Negligible | &lt;50 ms |
| Edge feathering | Distance-based alpha blend | Soft boundaries | Negligible | &lt;20 ms |
| Optional refinement | SD Inpainting (boundary-only) or harmonization | Fix seam only | 6–10 GB | 3–10 s |

**Total pipeline (without optional refinement):** ~1–2 s on a single mid-range GPU (e.g. A10, 24 GB), with segmentation + depth + normals + projection + lighting + feathering.  
**With optional diffusion:** add ~3–10 s and extra VRAM for one inpainting model.

---

## 5. Deployment and Modularity

- **Modularity:** Each stage (segment, depth, normals, project, lighting, feather, optional refine) is a separate step with clear inputs/outputs. Stages can be swapped (e.g. different depth model) without changing the rest.  
- **Production:** Run on GPU server or serverless GPU; input = original image + user mask + swatch(es); output = single composited image. No reliance on “describe then generate” for the main result.  
- **Geometry preservation:** Depth and normals drive warp and lighting; texture is the actual swatch; optional diffusion touches only boundary or low strength.  
- **Determinism:** Same inputs → same output except for the optional refinement step, which can be disabled or fixed-seed for near-determinism.

This plan is intended as the technical blueprint for replacing the current AI stack; implementation details (APIs, exact model versions, and code) are left for a follow-up phase.
