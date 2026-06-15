-- Restore session-scoped RLS on designer_profile.
-- Root cause of the earlier revert was a dual-session-ID bug in DesignerProfilePage
-- (used designer_session_id key instead of brief_session_id from lib/session.ts).
-- That bug is now fixed in the frontend — both the Supabase client header and the
-- profile page use the same brief_session_id key, so the header-based policy works.

DROP POLICY IF EXISTS "anon_all_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_select_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_insert_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_update_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_delete_designer_profile" ON public.designer_profile;

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
