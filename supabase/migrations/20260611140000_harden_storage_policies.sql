-- C-2: Harden storage RLS policies
-- 1. Drop unused DELETE policy on plan-uploads (no code path deletes plans)
DROP POLICY IF EXISTS "Anyone can delete plans" ON storage.objects;

-- 2. Replace open DELETE on designer-portfolio with path-structure check
DROP POLICY IF EXISTS "Allow deletes from designer-portfolio" ON storage.objects;
CREATE POLICY "Allow deletes from designer-portfolio"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (
  bucket_id = 'designer-portfolio'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    split_part(name, '/', 2) LIKE 'portfolio_%'
    OR split_part(name, '/', 2) LIKE 'kb_%'
  )
);

-- 3. Replace open INSERT on designer-portfolio with path-structure check
DROP POLICY IF EXISTS "Allow uploads to designer-portfolio" ON storage.objects;
CREATE POLICY "Allow uploads to designer-portfolio"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'designer-portfolio'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (
    split_part(name, '/', 2) LIKE 'portfolio_%'
    OR split_part(name, '/', 2) LIKE 'kb_%'
  )
);
