# generate-image

Uses the OpenAI **Image Edits** API (GPT Image model) with the project’s photo and your text prompt. The request uses **high input fidelity** so the same building, layout, and surroundings are preserved and only the requested style/appearance changes. The result is uploaded to Supabase Storage (`project-images` bucket, path `renders/{userId}/{projectId}-{timestamp}.png`) and the project is updated with `generated_image_url`, `generated_image_urls`, and `status: 'completed'`.

## Request

- **Method:** POST
- **Headers:** `Authorization: Bearer <user JWT>`
- **Body:** `{ "projectId": "<uuid>", "prompt": "text description", "samples": optional [{ "name": "Sample 1", "url": "https://..." }, ...] }`
  - If `samples` is provided, the first image is the project photo; following images are reference materials. The prompt is augmented so the model knows "Sample 1 = image 2", etc., so the user can say e.g. "replace the red brick with the stone in Sample 1 photo".

## Secrets

Set in Supabase Dashboard → Edge Functions → Secrets (or via CLI):

- `OPENAI_API_KEY` – Your OpenAI API key (required for image generation).

## Response

- **200:** `{ "generated_image_url": "<public URL>", "status": "completed" }`
- **4xx/5xx:** `{ "error": "...", "details": "..." }` and project `status` set to `failed` on server errors.
