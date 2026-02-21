# Why the AI rendering looked bad (and the simpler approach)

## What was going wrong

The current pipeline is:

1. **Describe the swatch** – Vision AI (OpenAI/LLaVA) turns your swatch image into text, e.g. “red brick with grey mortar”.
2. **Inpaint from text** – Stable Diffusion inpainting **generates** a new texture in the mask from that sentence.

So the contractor’s **actual product** (their swatch photo) is never used for the pixels. The model invents something that “matches the description.” That’s why it often looks generic, wrong, or low quality – it’s an approximation, not their real product.

For contractors you want: *“Your house with **this exact** siding/brick/roof.”*  
Text-based inpainting gives: *“Your house with something that sounds like that.”*

---

## Simpler approach that fits contractors

**Use the real swatch, not AI, for the material:**

1. **Client-side compositing** – In the browser, take the contractor’s **actual swatch image** and tile it only inside the masked area on the house photo. No AI for the material itself.
2. **Result** – The client sees their **exact product** on the house: same color, same texture, same scale (with simple auto-scale from mask size).
3. **No resize, no changing unmasked areas** – Keep the same dimensions and leave everything outside the mask exactly as in the original photo (we already do this with the “preserve unmasked” step when we have an AI result; with client composite the output is already “original + swatch in mask”).

So the flow is:

- **Mask + swatch** → Composite the **real swatch** in the mask (client-side) → Upload → Done.  
- **No mask** (e.g. “improve this photo”) → Optional upscale via Edge Function.

No “describe swatch” step, no “inpaint from text” step. Fewer moving parts, and the rendering shows the contractor’s real product instead of an AI guess.

---

## Optional polish (later)

If you want the pasted swatch to blend a bit better (lighting/edges), you can add **one** optional step later:

- Send the **composited** image (original + swatch in mask) to a model that only does “harmonize” or “blend edges,” and keep the rest of the image unchanged.

That can be a second phase. First phase: **exact product on the house, no AI for the material.**
