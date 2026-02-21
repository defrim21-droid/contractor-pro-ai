-- Add array column for multiple AI concepts per project
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS generated_image_urls text[] DEFAULT '{}';

-- Backfill: copy existing single concept into the array (keeps generated_image_url as-is for backward compat)
UPDATE projects
SET generated_image_urls = ARRAY[generated_image_url]
WHERE generated_image_url IS NOT NULL
  AND (generated_image_urls IS NULL OR array_length(generated_image_urls, 1) IS NULL);
