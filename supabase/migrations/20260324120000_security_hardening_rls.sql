-- Tighten RLS: no anonymous blanket access, scope data by session header.
-- The frontend sends x-session-id header via Supabase client global headers.

CREATE OR REPLACE FUNCTION public.request_session_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.headers', true)::json ->> 'x-session-id',
      current_setting('request.headers', true)::json ->> 'X-Session-Id'
    ),
    ''
  );
$$;

-- Drop permissive legacy policies.
DROP POLICY IF EXISTS "anon_select_projects" ON public.projects;
DROP POLICY IF EXISTS "anon_insert_projects" ON public.projects;
DROP POLICY IF EXISTS "anon_update_projects" ON public.projects;
DROP POLICY IF EXISTS "anon_delete_projects" ON public.projects;

DROP POLICY IF EXISTS "anon_select_briefs" ON public.briefs;
DROP POLICY IF EXISTS "anon_insert_briefs" ON public.briefs;
DROP POLICY IF EXISTS "anon_update_briefs" ON public.briefs;
DROP POLICY IF EXISTS "anon_delete_briefs" ON public.briefs;

DROP POLICY IF EXISTS "anon_select_issues" ON public.issues;
DROP POLICY IF EXISTS "anon_insert_issues" ON public.issues;
DROP POLICY IF EXISTS "anon_delete_issues" ON public.issues;

DROP POLICY IF EXISTS "anon_select_questions" ON public.questions;
DROP POLICY IF EXISTS "anon_insert_questions" ON public.questions;
DROP POLICY IF EXISTS "anon_update_questions" ON public.questions;
DROP POLICY IF EXISTS "anon_delete_questions" ON public.questions;

DROP POLICY IF EXISTS "anon_select_board_blocks" ON public.board_blocks;
DROP POLICY IF EXISTS "anon_insert_board_blocks" ON public.board_blocks;
DROP POLICY IF EXISTS "anon_update_board_blocks" ON public.board_blocks;
DROP POLICY IF EXISTS "anon_delete_board_blocks" ON public.board_blocks;

DROP POLICY IF EXISTS "anon_select_board_images" ON public.board_images;
DROP POLICY IF EXISTS "anon_insert_board_images" ON public.board_images;
DROP POLICY IF EXISTS "anon_update_board_images" ON public.board_images;
DROP POLICY IF EXISTS "anon_delete_board_images" ON public.board_images;

DROP POLICY IF EXISTS "anon_select_rooms" ON public.rooms;
DROP POLICY IF EXISTS "anon_insert_rooms" ON public.rooms;
DROP POLICY IF EXISTS "anon_update_rooms" ON public.rooms;
DROP POLICY IF EXISTS "anon_delete_rooms" ON public.rooms;

-- Projects are scoped to caller session.
CREATE POLICY "session_select_projects" ON public.projects
FOR SELECT TO anon, authenticated
USING (session_id = public.request_session_id());

CREATE POLICY "session_insert_projects" ON public.projects
FOR INSERT TO anon, authenticated
WITH CHECK (session_id = public.request_session_id());

CREATE POLICY "session_update_projects" ON public.projects
FOR UPDATE TO anon, authenticated
USING (session_id = public.request_session_id())
WITH CHECK (session_id = public.request_session_id());

CREATE POLICY "session_delete_projects" ON public.projects
FOR DELETE TO anon, authenticated
USING (session_id = public.request_session_id());

-- Child tables inherit access from owning project.
CREATE POLICY "session_select_briefs" ON public.briefs
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = briefs.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_insert_briefs" ON public.briefs
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = briefs.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_update_briefs" ON public.briefs
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = briefs.project_id
      AND p.session_id = public.request_session_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = briefs.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_delete_briefs" ON public.briefs
FOR DELETE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = briefs.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_select_issues" ON public.issues
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = issues.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_insert_issues" ON public.issues
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = issues.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_update_issues" ON public.issues
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = issues.project_id
      AND p.session_id = public.request_session_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = issues.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_delete_issues" ON public.issues
FOR DELETE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = issues.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_select_questions" ON public.questions
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = questions.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_insert_questions" ON public.questions
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = questions.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_update_questions" ON public.questions
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = questions.project_id
      AND p.session_id = public.request_session_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = questions.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_delete_questions" ON public.questions
FOR DELETE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = questions.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_select_board_blocks" ON public.board_blocks
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = board_blocks.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_insert_board_blocks" ON public.board_blocks
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = board_blocks.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_update_board_blocks" ON public.board_blocks
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = board_blocks.project_id
      AND p.session_id = public.request_session_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = board_blocks.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_delete_board_blocks" ON public.board_blocks
FOR DELETE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = board_blocks.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_select_board_images" ON public.board_images
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.board_blocks bb
    JOIN public.projects p ON p.id = bb.project_id
    WHERE bb.id = board_images.block_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_insert_board_images" ON public.board_images
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.board_blocks bb
    JOIN public.projects p ON p.id = bb.project_id
    WHERE bb.id = board_images.block_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_update_board_images" ON public.board_images
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.board_blocks bb
    JOIN public.projects p ON p.id = bb.project_id
    WHERE bb.id = board_images.block_id
      AND p.session_id = public.request_session_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.board_blocks bb
    JOIN public.projects p ON p.id = bb.project_id
    WHERE bb.id = board_images.block_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_delete_board_images" ON public.board_images
FOR DELETE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.board_blocks bb
    JOIN public.projects p ON p.id = bb.project_id
    WHERE bb.id = board_images.block_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_select_rooms" ON public.rooms
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = rooms.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_insert_rooms" ON public.rooms
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = rooms.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_update_rooms" ON public.rooms
FOR UPDATE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = rooms.project_id
      AND p.session_id = public.request_session_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = rooms.project_id
      AND p.session_id = public.request_session_id()
  )
);

CREATE POLICY "session_delete_rooms" ON public.rooms
FOR DELETE TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = rooms.project_id
      AND p.session_id = public.request_session_id()
  )
);

-- Tighten style-images write access: only service role should upload cache.
DROP POLICY IF EXISTS "service_insert_style_images" ON storage.objects;

CREATE POLICY "service_insert_style_images" ON storage.objects
FOR INSERT TO service_role
WITH CHECK (bucket_id = 'style-images');
