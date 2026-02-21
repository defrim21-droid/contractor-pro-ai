# Queue + Railway Worker Design for Image Generation

This document outlines the architecture for moving image generation from Supabase Edge Functions to a Dockerized Railway worker, using a database-backed job queue.

---

## 1. Overview

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Frontend  │────▶│  Edge Function       │────▶│  jobs table     │◀────│  Railway     │
│             │     │  (enqueue only)      │     │  (queue)        │     │  Worker      │
└─────────────┘     └──────────────────────┘     └─────────────────┘     └──────┬───────┘
       │                        │                         │                      │
       │                        │                         │                      │
       │                        ▼                         │                      ▼
       │               ┌─────────────────┐                │             ┌──────────────┐
       │               │  projects       │                │             │  OpenAI API  │
       │               │  status update  │                │             │  Supabase    │
       └──────────────▶│  (processing)   │                │             │  Storage     │
                       └─────────────────┘                │             └──────────────┘
                                  ▲                       │
                                  └───────────────────────┘
                                     worker updates on completion
```

**Flow summary:**
1. Frontend calls Edge Function `generate-image` with projectId, prompt, samples, mask(s).
2. Edge Function validates, sets project status to `processing`, inserts a job row, returns jobId.
3. Railway worker polls for pending jobs, processes them (OpenAI + upload), updates project and job.
4. Frontend polls project status (or uses Supabase Realtime) until `completed` or `failed`.

---

## 2. Database Schema

### 2.1 New table: `generation_jobs`

```sql
CREATE TABLE generation_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  status        text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload       jsonb NOT NULL,
  result_url    text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for worker polling (pending jobs, oldest first)
CREATE INDEX idx_generation_jobs_pending 
  ON generation_jobs (created_at) 
  WHERE status = 'pending';

-- Index for project lookup
CREATE INDEX idx_generation_jobs_project 
  ON generation_jobs (project_id);

-- RLS: users can read their own jobs
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own jobs"
  ON generation_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (worker uses service key)
-- No INSERT/SELECT for anon/authenticated; Edge Function uses service role
```

### 2.2 `payload` structure (JSONB)

```typescript
{
  prompt: string;
  samples: { name: string; url: string }[];
  mask?: string;                    // data URL, single mask
  maskRegions?: { sampleIndex: number; mask: string }[];  // multi-region
  inputImageUrl?: string;           // override base image URL
  projectType: string | null;       // existing | new_build | architectural_drawing
}
```

The project's `original_image_url` and `project_type` are read by the worker from the `projects` table; `inputImageUrl` overrides the base image when editing from a different source.

---

## 3. Job Flow (End-to-End)

### 3.1 Frontend → Edge Function (enqueue)

1. User clicks "Save & Render" in WorkspaceEditor.
2. Frontend creates/updates project via `processAiRenovation`, gets `projectId`.
3. Frontend calls Edge Function `generate-image` with:
   ```json
   {
     "projectId": "uuid",
     "prompt": "apply brick in sample 1 to red area...",
     "samples": [{ "name": "Brick", "url": "https://..." }],
     "mask": "data:image/png;base64,...",
     "maskRegions": null,
     "inputImageUrl": null
   }
   ```

### 3.2 Edge Function (enqueue only)

1. Validate `projectId`, `prompt`, auth.
2. Load project, check `original_image_url`.
3. Update project: `status = 'processing'`.
4. Insert row into `generation_jobs`:
   ```sql
   INSERT INTO generation_jobs (project_id, user_id, payload)
   VALUES ($projectId, $userId, $payload)
   RETURNING id, created_at;
   ```
5. Return `{ "jobId": "...", "status": "processing" }` (no image generation here).

### 3.3 Railway Worker (process)

1. **Poll** (every 2–5 seconds):
   ```sql
   SELECT id, project_id, user_id, payload
   FROM generation_jobs
   WHERE status = 'pending'
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;
   ```
2. **Lock & claim**: `UPDATE generation_jobs SET status = 'processing', started_at = now() WHERE id = $id`.
3. **Process**:
   - Load project from Supabase (`original_image_url`, `project_type`).
   - Run existing `runEdit` logic (OpenAI Image Edits API).
   - Upload result to Supabase Storage.
   - Update project: `generated_image_url`, `generated_image_urls`, `status = 'completed'`.
4. **Finish job**: `UPDATE generation_jobs SET status = 'completed', result_url = $url, completed_at = now() WHERE id = $id`.
5. On error: set project `status = 'failed'`, job `status = 'failed'`, `error_message = $err`.

### 3.4 Frontend (status polling)

1. After Edge Function returns, frontend has `jobId` and `projectId`.
2. **Option A – project polling**: Poll `projects` by `projectId` every 2–3 seconds until `status` is `completed` or `failed`.
3. **Option B – Realtime**: Subscribe to `projects` changes for `projectId`; Supabase Realtime will push updates when the worker updates the row.
4. On `completed`: refresh project, show generated image.
5. On `failed`: show error message.

---

## 4. Code Structure

### 4.1 Repository layout

```
contractor-pro-ai/
├── supabase/
│   ├── functions/
│   │   └── generate-image/          # SLIM: enqueue only
│   │       └── index.ts
│   └── migrations/
│       └── YYYYMMDD_create_generation_jobs.sql
├── worker/                           # NEW: Railway worker
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # Main loop: poll → process
│   │   ├── processor.ts             # runEdit + upload (extracted from generate-image)
│   │   ├── prompt.ts                # buildPrompt, CONSTRAINTS
│   │   └── supabase.ts              # Supabase client (service role)
│   └── .env.example
└── src/
    └── WorkspaceEditor.jsx          # Call generate-image, poll project status
```

### 4.2 Edge Function (`generate-image/index.ts`) – slim version

**Responsibilities:**
- Auth
- Validate projectId, prompt
- Load project
- Insert job into `generation_jobs`
- Update project `status = 'processing'`
- Return `{ jobId, status: 'processing' }`

**Removed:**
- `getImageDimensions`, `resizeMaskToMatch`, `runEdit`
- OpenAI call
- Storage upload
- All ImageScript / heavy processing

### 4.3 Worker (`worker/src/`)

| File          | Purpose                                                                 |
|---------------|-------------------------------------------------------------------------|
| `index.ts`    | Poll `generation_jobs`, claim job, call processor, update DB            |
| `processor.ts`| Reuse logic from current `generate-image`: runEdit, resize, upload      |
| `prompt.ts`   | Extract `buildPrompt`, `CONSTRAINTS`, `COLOR_NAMES`                     |
| `supabase.ts` | Supabase client with `SUPABASE_SERVICE_ROLE_KEY`                        |

**Dependencies:**
- `@supabase/supabase-js`
- `openai` or raw `fetch` for Image Edits API
- Image processing: `sharp` (Node) or `jimp` – equivalent of ImageScript for resize/decode

### 4.4 Worker Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

**Build:** `npm run build` outputs to `dist/`. Railway runs the container and sets env vars.

---

## 5. Environment Variables

### 5.1 Edge Function (Supabase)

| Variable         | Purpose                    |
|------------------|----------------------------|
| `SUPABASE_URL`   | Supabase project URL       |
| `SUPABASE_SERVICE_ROLE_KEY` | For inserting jobs (bypass RLS) |

### 5.2 Worker (Railway)

| Variable             | Purpose                          |
|----------------------|----------------------------------|
| `SUPABASE_URL`       | Supabase project URL             |
| `SUPABASE_SERVICE_ROLE_KEY` | Read/write jobs, projects, storage |
| `OPENAI_API_KEY`     | OpenAI Image Edits API           |

---

## 6. Worker Polling Strategy

- **Interval:** 3 seconds (configurable).
- **Claim:** Use `FOR UPDATE SKIP LOCKED` to avoid multiple workers processing the same job.
- **Timeout:** Optional `started_at` check; if `processing` for > 10 minutes, mark as `failed` and retry (or dead-letter).

---

## 7. Frontend Changes

### 7.1 `WorkspaceEditor.jsx` – render flow

**Before:** Call `generate-image`, wait for 200 with `generated_image_url`.

**After:**
1. Call `generate-image`; expect `{ jobId, status: 'processing' }`.
2. Subscribe to `projects` Realtime for `projectId`, or poll `projects` until `status` is `completed` or `failed`.
3. On `completed`: refetch project, show image.
4. On `failed`: show error (e.g. from `generation_jobs.error_message` or a generic message).

### 7.2 Error handling

- If Edge Function returns an error (e.g. validation), show toast immediately.
- If job is enqueued but later fails, Realtime or polling will see `status = 'failed'`; you can fetch `error_message` from `generation_jobs` for that project’s latest job.

---

## 8. Migration Path

> **Implementation complete.** Migration, worker, slim Edge Function, and frontend updates are in place.

1. **Phase 1 – Schema**
   - Migration: `supabase/migrations/20250220000000_create_generation_jobs.sql`
   - Run: `supabase db push` (or deploy migration)

2. **Phase 2 – Worker**
   - Create `worker/` directory.
   - Port `runEdit`, `resizeMaskToMatch`, `getImageDimensions`, `buildPrompt` from Edge Function to worker.
   - Implement polling loop.
   - Deploy to Railway.

3. **Phase 3 – Edge Function**
   - Replace heavy logic with enqueue-only code.
   - Redeploy Edge Function.

4. **Phase 4 – Frontend**
   - Update `WorkspaceEditor` to handle async job flow (Realtime or polling).
   - Test end-to-end.

---

## 9. Rollback

- If the worker fails, keep the old Edge Function code in a branch.
- Revert Edge Function to synchronous execution and redeploy.
- Jobs in `generation_jobs` with `status = 'pending'` can be processed later or cleaned up.

---

## 10. Optional Enhancements

- **Retries:** Worker retries failed jobs (e.g. 3 attempts) before marking `failed`.
- **Dead-letter:** Move permanently failed jobs to a `failed_jobs` table for inspection.
- **Metrics:** Log job duration, success rate; expose via Railway or a simple dashboard.
- **Webhook:** Use Supabase `pg_net` or Database Webhooks to POST to the worker on `INSERT` into `generation_jobs`, reducing polling load.
