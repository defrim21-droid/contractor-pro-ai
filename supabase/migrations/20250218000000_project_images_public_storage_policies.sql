-- Storage policies for project-images-public bucket.
-- Run this AFTER creating the bucket in Supabase Dashboard (Storage > New bucket > project-images-public, Public).
-- Authenticated users can upload; public bucket allows reads without auth.

CREATE POLICY "Allow authenticated uploads to project-images-public"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-images-public');

CREATE POLICY "Allow authenticated updates in project-images-public"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'project-images-public');

CREATE POLICY "Allow public read from project-images-public"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'project-images-public');
