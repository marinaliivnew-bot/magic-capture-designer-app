ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS original_ai JSONB,
  ADD COLUMN IF NOT EXISTS revision_source TEXT NOT NULL DEFAULT 'ai';

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS original_ai JSONB,
  ADD COLUMN IF NOT EXISTS revision_source TEXT NOT NULL DEFAULT 'ai';

ALTER TABLE public.board_blocks
  ADD COLUMN IF NOT EXISTS original_ai_caption TEXT,
  ADD COLUMN IF NOT EXISTS caption_source TEXT NOT NULL DEFAULT 'ai';
