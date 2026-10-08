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
