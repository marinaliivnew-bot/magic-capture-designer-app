DROP POLICY IF EXISTS "allow_public_insert_user_refs" ON storage.objects;
CREATE POLICY "allow_public_insert_user_refs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'style-images'
  AND name LIKE 'user-refs/%'
);
