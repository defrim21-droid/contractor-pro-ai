# Integration Plan: Python AI Render Pipeline

Replace both current flows (client-side composite and Edge Function/Replicate) with a single flow: frontend → Python API → `run_render_pipeline` → Supabase storage, with job ID and polling.

---

## 1. Integration Architecture

### High-level flow

```
[React App]  →  upload assets to Supabase Storage (unchanged)
            →  POST /render/jobs  (image_url, texture_url, options)  →  [Python API]
            ←  201 { job_id }
            →  GET /render/jobs/{job_id}  (poll)
            ←  200 { status, result_url? }  when status = completed | failed
            →  update project in Supabase (generated_image_url, status) using result_url or error
```

- **Single backend for render:** One Python API (e.g. FastAPI) that owns all render work. No Edge Function for render; no client-side composite for the final image.
- **Assets stay in Supabase:** Frontend continues to upload original image, mask, and swatch URLs to Supabase and passes **public URLs** (or signed URLs) to the Python API. The API downloads from those URLs, runs the pipeline, then uploads the result back to Supabase Storage.
- **Python API responsibilities:**
  - Accept render request (image URL, texture URL, options).
  - Create a **job** (in-memory store or DB/Redis), return `job_id`.
  - Run `run_render_pipeline(image_url, texture_url, ...)` in a **background task** (thread, asyncio task, or Celery).
  - On success: upload `final_image` to Supabase Storage (path provided by client or derived from `project_id`/job_id), update job with `result_url` and `status: completed`.
  - On failure: update job with `status: failed` and `error_message`.
  - Expose **polling** endpoint: `GET /render/jobs/{job_id}` returns current status and, when completed, `result_url`.
- **Frontend:** After creating/updating the project row (with `status: 'processing'`), call Python API to submit the job, then poll until completed/failed; then update the project with `generated_image_url` / `generated_image_urls` and `status: 'completed' | 'failed'`.

### Component diagram

| Component | Role |
|-----------|------|
| React app | Upload assets → Supabase. Create/update project. Submit job to Python API. Poll job. Update project with result. |
| Supabase (DB) | Store project (original_image_url, mask_url, swatch_data, status, generated_image_url). |
| Supabase Storage | Hold original image, mask, swatches; hold **final render** (uploaded by Python API). |
| Python API | Submit job → enqueue work; background worker runs `run_render_pipeline`; upload result to Supabase; job store holds status + result_url. |
| Python services | `run_render_pipeline(image, texture_image, ...)` as today; no change to pipeline logic. |

### Cleanest option: URL-based, stateless job store

- **Submit:** Client sends `image_url`, `texture_url`, optional `project_id`, `user_id`, and options. API generates `job_id` (UUID), stores job in a small store (e.g. Redis, or Supabase table `render_jobs`), starts background pipeline. Returns `job_id` and optional `poll_url`.
- **Pipeline:** Runs in a background thread/process; downloads image and texture from URLs; calls `run_render_pipeline`; uploads result to Supabase using Supabase client (service role or signed upload). Writes result path/URL and status back to job record.
- **Poll:** Client calls `GET /render/jobs/{job_id}`. Response includes `status`, `result_url` (when completed), `error_code`/`error_message` (when failed). No session affinity required.

---

## 2. Request / Response Contract

### POST /render/jobs — Submit a render job

**Request (JSON)**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_url` | string | Yes | Public (or signed) URL of the source photo. API will fetch and pass to pipeline as image path/URL. |
| `texture_url` | string | Yes | Public (or signed) URL of the texture/swatch image. For "no swatch" (e.g. upscale-only), caller may send same as image or a dedicated "passthrough" texture; or a separate endpoint for upscale-only. |
| `project_id` | string (UUID) | No | Project id for storage path and DB update. If provided, API can write result to `renders/{user_id}/{project_id}-{timestamp}.png`. |
| `user_id` | string (UUID) | No | Required if project_id present; used for storage path. |
| `options` | object | No | Pipeline options (see below). |

**Options (nested object, all optional)**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `real_world_scale` | number | 24 | Texture repeats. |
| `enable_refinement` | boolean | false | Run diffusion refinement. |
| `refinement_seed` | number | 42 | Seed when refinement enabled. |
| `stage_timeout_seconds` | number | null | Per-stage timeout. |

**Response**

- **201 Created**
  - Body: `{ "job_id": "<uuid>", "status": "processing", "poll_url": "/render/jobs/<job_id>" }` (or omit poll_url if obvious).
- **400 Bad Request**
  - Body: `{ "error": "validation_failed", "details": { "image_url": "invalid or unreachable" } }`.
- **503 Service Unavailable**
  - Body: `{ "error": "queue_full" }` if you enforce a max queue size.

### GET /render/jobs/{job_id} — Poll job status

**Response**

- **200 OK**
  - Body:
    - `status: "processing"` → `{ "job_id": "...", "status": "processing" }`.
    - `status: "completed"` → `{ "job_id": "...", "status": "completed", "result_url": "https://...supabase.../renders/..." }`.
    - `status: "failed"` → `{ "job_id": "...", "status": "failed", "error_code": "pipeline_error", "error_message": "..." }`.
- **404 Not Found**
  - Body: `{ "error": "job_not_found" }`.

**Error codes (for `failed`)**

- `pipeline_error` — Exception in pipeline (stage failure, timeout, OOM).
- `download_failed` — Could not fetch image_url or texture_url.
- `upload_failed` — Could not upload result to Supabase.
- `validation_failed` — Invalid resolution or inputs (e.g. image too small/large).

### Unifying “no mask” and “mask + swatch”

- **Mask + swatch:** `image_url` = original photo, `texture_url` = primary swatch image (or first swatch). Pipeline uses segmentation to get facade; no client mask URL required for the **new** stack (pipeline infers paintable regions). If you want to keep passing a mask URL for a future variant, add optional `mask_url` to the contract; the current pipeline does not use it.
- **No mask / upscale-only:** Same endpoint: `image_url` = original, `texture_url` = same as `image_url` (or a neutral texture). Pipeline still runs (segment → depth → project → optional refine). Result is effectively “enhanced” image. Alternatively, define a separate `POST /render/jobs/upscale` that skips texture and only runs depth + optional refine; for minimal change, reusing the same pipeline with image = texture is acceptable so **one contract** suffices.

---

## 3. Job Lifecycle

### States

| State | Description | Next states |
|-------|-------------|-------------|
| `processing` | Job created; pipeline running (or queued). | `completed`, `failed` |
| `completed` | Pipeline finished; result uploaded; `result_url` set. | — |
| `failed` | Pipeline or upload failed; `error_code` and `error_message` set. | — |

Optional: `queued` (waiting for worker) if you use a queue; then `queued` → `processing` → `completed` | `failed`.

### Lifecycle sequence

1. **Create:** API generates `job_id`, stores record `{ job_id, status: "processing", created_at, image_url, texture_url, project_id?, user_id?, options }`, starts background task.
2. **Run:** Background task downloads image and texture, calls `run_render_pipeline(image_path_or_url, texture_path_or_url, ...)`. Pipeline returns `final_image` (and optionally `output_path` if written to disk).
3. **Upload:** Worker uploads `final_image` to Supabase Storage (e.g. `project-images` bucket, path `renders/{user_id}/{project_id}-{job_id}.png`). Obtains public URL.
4. **Complete:** Worker updates job record: `status: "completed"`, `result_url: "<public URL>"`, `completed_at`.
5. **Failure:** On any exception or timeout, worker updates job record: `status: "failed"`, `error_code`, `error_message`, `completed_at`.

### Retention

- Jobs can be kept for a limited time (e.g. 24–48 hours) for debugging; then delete or archive. Optional: store only `job_id`, `status`, `result_url`, `error_message`, `created_at`, `completed_at` in DB and drop large fields after completion.

---

## 4. Error Handling

### API layer (before pipeline)

- **Invalid or missing `image_url` / `texture_url`:** Return 400 with `validation_failed`; optionally HEAD-request URLs to check reachability.
- **Missing `user_id` when `project_id` provided:** 400.
- **Queue full (if applicable):** 503 with `queue_full`; client can retry with backoff.

### Pipeline / worker

- **Download failure:** Set job to `failed`, `error_code: "download_failed"`, `error_message` with detail (e.g. 403, timeout). Do not retry indefinitely; one retry is optional.
- **Pipeline exception (stage failure, OOM, timeout):** Catch exception, set job to `failed`, `error_code: "pipeline_error"`, `error_message` from exception (sanitize if needed). Optionally log `stages` or partial result for debugging.
- **Upload to Supabase failure:** Set job to `failed`, `error_code: "upload_failed"`. Client will see failure and can show a generic “render failed, try again” message.

### Frontend

- **Submit returns 4xx/5xx:** Show error message; do not start polling. Keep project in `processing` or revert to previous state.
- **Poll returns `failed`:** Update project `status: 'failed'`, show `error_message` (or user-friendly text). Optionally store `error_message` in project or in a toast.
- **Poll timeout:** After N minutes (e.g. 5–10), stop polling and show “Render is taking longer than usual; we’ll notify you” or mark project as failed with `error_code: "timeout"` if the backend supports marking timed-out jobs as failed.

### Idempotency (optional)

- If the client retries POST due to network issues, consider idempotency key (e.g. `project_id` + generation id) so duplicate submissions do not create two jobs for the same project update.

---

## 5. Environment Requirements

### Python API / worker

- **Runtime:** Python 3.10+.
- **Dependencies:** All existing `services/requirements-*.txt` (segmentation, depth, texture-projection, diffusion-refinement); plus FastAPI (or Flask), uvicorn, HTTP client (requests or httpx), Supabase client (or minimal REST for storage upload).
- **Environment variables:**
  - **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for server-side upload to storage and optional job table).
  - **Storage bucket:** Same as app (`project-images`); path convention `renders/{user_id}/{project_id}-{job_id}.png` or as agreed.
  - **Optional:** `RENDER_STAGE_TIMEOUT`, `AI_FORCE_CPU`, model paths (GroundingDINO, etc.) as in existing services.
- **GPU:** Recommended for acceptable latency; CPU fallback already supported in services.
- **Concurrency:** One pipeline run per process (or per worker) to avoid GPU OOM; queue depth limit recommended (e.g. 1–2 per GPU).

### Frontend

- **API base URL:** Configure base URL for the Python API (e.g. `VITE_RENDER_API_URL` or `REACT_APP_RENDER_API_URL`). Default for dev: `http://localhost:8000` (or chosen port).
- **CORS:** Python API must allow origin of the React app (and credentials if cookies used).

### Supabase

- **Storage:** Bucket `project-images` with policy allowing service role to upload; existing public read policy for result URLs.
- **Optional:** New table `render_jobs` (job_id, project_id, user_id, status, result_url, error_code, error_message, created_at, completed_at) if job state is persisted in DB instead of in-memory/Redis.

---

## 6. Minimal Changes to React App

### Current behavior to replace

- **Mask + swatch:** Call `compositeSwatchOntoImage` + `applyOverlayPreservation`, upload result, update project.
- **No mask:** Call `supabase.functions.invoke('generate-renovation', { body: { projectId } })`, then rely on Edge Function to update project (or poll project row).

### New behavior (single path)

1. **Upload and DB (unchanged):** Keep existing logic: upload original image, mask, swatches to Supabase; create or update project row with `original_image_url`, `mask_url`, `swatch_data`, and set `status: 'processing'`.
2. **Submit job:** After DB success, call `POST /render/jobs` with:
   - `image_url`: project’s `original_image_url` (or the uploaded original URL).
   - `texture_url`: first swatch’s `url` from `swatch_data` if swatches exist; otherwise `original_image_url` (for “no swatch” / upscale-like path).
   - `project_id`: project id.
   - `user_id`: current user id.
   - `options`: e.g. `{ enable_refinement: false }` (or from a future UI toggle).
3. **Poll:** On 201, start polling `GET /render/jobs/{job_id}` every 2–3 seconds (or exponential backoff). Stop when `status === 'completed'` or `status === 'failed'`.
4. **On completed:** Update project via Supabase: set `generated_image_url` and `generated_image_urls` (append new URL), `status: 'completed'`. Refresh UI.
5. **On failed:** Update project `status: 'failed'`; show `error_message` (or generic message) to the user.

### Files to touch (minimal)

| File | Change |
|------|--------|
| `src/aiService.js` | Replace the two branches (client composite and Edge Function invoke) with: single flow that (1) uploads + updates DB as today, (2) calls new `submitRenderJob(imageUrl, textureUrl, projectId, userId, options)` and then `pollRenderJob(jobId)` until done, (3) updates project with `result_url` or marks failed. |
| `src/api/renderApi.js` (new) | Thin client: `submitRenderJob(...)` → POST to Python API, returns `{ job_id }`; `pollRenderJob(jobId)` → GET until completed/failed, returns `{ status, result_url?, error_message? }`. Base URL from env. |
| Env | Add `VITE_RENDER_API_URL` (or equivalent) for the Python API base URL. |

### What to remove or keep

- **Remove:** Direct use of `compositeSwatchOntoImage`, `prepareSwatchesForComposite`, `mergeMaskBlobs`, `applyOverlayPreservation` for the **final** render path. You can keep the functions in the codebase for a fallback or for “preview” if desired later.
- **Remove:** `supabase.functions.invoke('generate-renovation', ...)` for the no-mask path.
- **Keep:** All upload logic (original, mask, swatches) and project create/update; only the “how we get the final image” changes.

### UX

- Show “Rendering…” (or spinner) while polling. Optionally show “Step 1/5: Segmenting…” if the API exposes stage progress (optional future enhancement; not required for minimal contract).
- On failure, show a clear message and optionally a “Retry” button that resubmits the same project.

---

## Summary

| Item | Decision |
|------|----------|
| **Architecture** | Frontend uploads to Supabase → POST to Python API with image + texture URLs → API runs pipeline in background, uploads result to Supabase, returns job_id → Frontend polls GET /jobs/{id} → Frontend updates project with result_url or error. |
| **Contract** | POST /render/jobs: image_url, texture_url, project_id?, user_id?, options. Response: job_id, status, poll_url. GET /render/jobs/{id}: status, result_url (if completed), error_code + error_message (if failed). |
| **Job lifecycle** | processing → completed | failed; optional queued; retention 24–48h. |
| **Errors** | 400 validation, 503 queue full; job-level download_failed, pipeline_error, upload_failed; frontend handles failed + timeout. |
| **Environment** | Python: 3.10+, services deps, Supabase keys, optional GPU; Frontend: render API base URL; Supabase: storage for results. |
| **React changes** | One flow in aiService: upload + DB → submit job → poll → update project; new small renderApi.js; add env var; remove client composite and Edge Function invoke for final image. |

This plan keeps the pipeline implementation unchanged and confines integration to a thin API layer, job store, and frontend job submit/poll + project update.
