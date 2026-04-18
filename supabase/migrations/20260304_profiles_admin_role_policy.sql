-- Allow admins to manage profile roles (including moderator/admin assignment).
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
FOR UPDATE
USING (public.current_app_role() = 'admin'::public.app_role)
WITH CHECK (public.current_app_role() = 'admin'::public.app_role);

