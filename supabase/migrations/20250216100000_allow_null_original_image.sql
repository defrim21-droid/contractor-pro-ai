-- Allow projects to be created without an image (user adds photo in editor after project details)
ALTER TABLE projects
ALTER COLUMN original_image_url DROP NOT NULL;
