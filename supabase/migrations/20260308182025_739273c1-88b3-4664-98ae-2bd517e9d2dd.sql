INSERT INTO storage.buckets (id, name, public)
VALUES ('style-images', 'style-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_style_images" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'style-images');

CREATE POLICY "service_insert_style_images" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'style-images');