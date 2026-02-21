-- Add client_email to projects for sharing renders with clients
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_email text;
