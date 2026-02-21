-- Job queue for image generation (processed by Railway worker)
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
