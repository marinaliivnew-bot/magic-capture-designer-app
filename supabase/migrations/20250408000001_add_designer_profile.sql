-- Migration: Add designer_profile table for v2-three-layer
-- Created: 2025-04-08

-- Table: designer_profile
CREATE TABLE IF NOT EXISTS designer_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  style_description text,        -- "люблю тёплые интерьеры"
  style_refs jsonb DEFAULT '[]'::jsonb,              -- ссылки/URL референсов
  hard_constraints jsonb DEFAULT '{}'::jsonb,        -- "не использую глянец"
  ergonomics_rules jsonb DEFAULT '{}'::jsonb,        -- "минимум 70 см проход"
  custom_ergonomics_text text,    -- загруженный PDF или текст
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE designer_profile ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (MVP - no auth)
CREATE POLICY "Allow all operations on designer_profile" 
  ON designer_profile 
  FOR ALL 
  TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);

-- Index on session_id for fast lookups
CREATE INDEX idx_designer_profile_session_id ON designer_profile(session_id);

-- Trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_designer_profile_updated_at
  BEFORE UPDATE ON designer_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
