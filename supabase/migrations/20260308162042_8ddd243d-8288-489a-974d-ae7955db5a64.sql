-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  room_type TEXT,
  dimensions_text TEXT,
  raw_input TEXT,
  constraints JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create briefs table
CREATE TABLE public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  users_of_space TEXT,
  scenarios TEXT,
  zones TEXT,
  storage TEXT,
  style_likes TEXT,
  style_dislikes TEXT,
  constraints_practical TEXT,
  success_criteria TEXT,
  completeness_score INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create issues table (contradictions + gaps)
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('contradiction', 'gap')),
  title TEXT NOT NULL,
  evidence TEXT,
  impact TEXT,
  suggestion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'important',
  text TEXT NOT NULL,
  unlocks TEXT,
  asked BOOLEAN NOT NULL DEFAULT false,
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create board_blocks table
CREATE TABLE public.board_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create board_images table
CREATE TABLE public.board_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.board_blocks(id) ON DELETE CASCADE,
  url TEXT,
  source_type TEXT,
  source_url TEXT,
  attribution TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_images ENABLE ROW LEVEL SECURITY;

-- Anonymous MVP: allow public access via anon key, session filtering in app code
CREATE POLICY "anon_select_projects" ON public.projects FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_projects" ON public.projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_projects" ON public.projects FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_projects" ON public.projects FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_briefs" ON public.briefs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_briefs" ON public.briefs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_briefs" ON public.briefs FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_briefs" ON public.briefs FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_issues" ON public.issues FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_issues" ON public.issues FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_delete_issues" ON public.issues FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_questions" ON public.questions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_questions" ON public.questions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_questions" ON public.questions FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_questions" ON public.questions FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_board_blocks" ON public.board_blocks FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_board_blocks" ON public.board_blocks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_board_blocks" ON public.board_blocks FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_board_blocks" ON public.board_blocks FOR DELETE TO anon USING (true);

CREATE POLICY "anon_select_board_images" ON public.board_images FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_board_images" ON public.board_images FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_board_images" ON public.board_images FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_delete_board_images" ON public.board_images FOR DELETE TO anon USING (true);

-- Trigger for updated_at on briefs
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_briefs_updated_at
  BEFORE UPDATE ON public.briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();