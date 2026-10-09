-- P0: Harden is_admin so authorization uses verified auth.uid() only.
-- Parameter is accepted for RLS compatibility (is_admin(auth.uid())) but
-- cannot be used to check arbitrary users or escalate without a session.
DROP FUNCTION IF EXISTS public.is_admin(uuid);

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND (uid IS NULL OR uid = auth.uid())
    AND EXISTS (
      SELECT 1 FROM admin_memberships WHERE user_id = auth.uid()
    );
$function$;
