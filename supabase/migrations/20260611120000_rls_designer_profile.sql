-- Tighten RLS on designer_profile: replace blanket USING(true) policy
-- with session-scoped policies matching the projects pattern.

-- Ensure helper function exists (idempotent — same definition as security_hardening_rls).
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

-- Drop legacy permissive policy.
DROP POLICY IF EXISTS "Allow all operations on designer_profile" ON public.designer_profile;

-- designer_profile has its own session_id column — same direct pattern as projects.
CREATE POLICY "session_select_designer_profile" ON public.designer_profile
FOR SELECT TO anon, authenticated
USING (session_id = public.request_session_id());

CREATE POLICY "session_insert_designer_profile" ON public.designer_profile
FOR INSERT TO anon, authenticated
WITH CHECK (session_id = public.request_session_id());

CREATE POLICY "session_update_designer_profile" ON public.designer_profile
FOR UPDATE TO anon, authenticated
USING (session_id = public.request_session_id())
WITH CHECK (session_id = public.request_session_id());

CREATE POLICY "session_delete_designer_profile" ON public.designer_profile
FOR DELETE TO anon, authenticated
USING (session_id = public.request_session_id());
