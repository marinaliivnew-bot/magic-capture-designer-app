-- Revert designer_profile RLS to permissive: app-level .eq() scopes by session_id.
-- Header-based policy broke because DesignerProfilePage used a separate localStorage key
-- (designer_session_id vs brief_session_id used by the Supabase client header).
DROP POLICY IF EXISTS "session_select_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_insert_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_update_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "session_delete_designer_profile" ON public.designer_profile;
DROP POLICY IF EXISTS "anon_all_designer_profile" ON public.designer_profile;

CREATE POLICY "anon_all_designer_profile" ON public.designer_profile
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);
