ALTER TABLE public.board_blocks
  ADD COLUMN IF NOT EXISTS color_chips JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lighting_zones JSONB DEFAULT '[]'::jsonb;
