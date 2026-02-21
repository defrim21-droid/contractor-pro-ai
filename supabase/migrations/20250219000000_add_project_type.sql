-- Add project_type for new build / existing / architectural drawing
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_type text;
