-- Migration: Add designer-portfolio storage bucket
-- Created: 2025-04-08

-- Create bucket for designer portfolio uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('designer-portfolio', 'designer-portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow anyone to upload files (MVP - no auth)
CREATE POLICY "Allow uploads to designer-portfolio" 
  ON storage.objects 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (bucket_id = 'designer-portfolio');

-- Policy: Allow anyone to read files
CREATE POLICY "Allow reads from designer-portfolio" 
  ON storage.objects 
  FOR SELECT 
  TO anon, authenticated 
  USING (bucket_id = 'designer-portfolio');

-- Policy: Allow anyone to delete their own files
CREATE POLICY "Allow deletes from designer-portfolio" 
  ON storage.objects 
  FOR DELETE 
  TO anon, authenticated 
  USING (bucket_id = 'designer-portfolio');
