-- Fix designer_profile schema:
-- 1. Add missing columns (designer_name, ai_analysis, ai_questions)
-- 2. Add UNIQUE constraint on session_id (required for upsert onConflict to work)

ALTER TABLE public.designer_profile
  ADD COLUMN IF NOT EXISTS designer_name text,
  ADD COLUMN IF NOT EXISTS ai_analysis text,
  ADD COLUMN IF NOT EXISTS ai_questions jsonb DEFAULT '[]'::jsonb;

-- Remove duplicate rows before adding unique constraint (keep most recently updated)
DELETE FROM public.designer_profile
WHERE id NOT IN (
  SELECT DISTINCT ON (session_id) id
  FROM public.designer_profile
  ORDER BY session_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
);

-- Add unique constraint so upsert({ onConflict: "session_id" }) works correctly
ALTER TABLE public.designer_profile
  DROP CONSTRAINT IF EXISTS designer_profile_session_id_unique;

ALTER TABLE public.designer_profile
  ADD CONSTRAINT designer_profile_session_id_unique UNIQUE (session_id);
