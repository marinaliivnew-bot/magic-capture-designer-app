ALTER TABLE public.briefs
ADD COLUMN IF NOT EXISTS user_refs_structured jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.briefs
ADD COLUMN IF NOT EXISTS client_taste_result jsonb DEFAULT NULL;

ALTER TABLE public.briefs
ADD COLUMN IF NOT EXISTS agreed_style_result jsonb DEFAULT NULL;
