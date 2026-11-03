-- 016_guard-other-admin-functions.sql
--
-- Same treatment as 015 for the remaining SECURITY DEFINER admin
-- functions. The live audit showed all four with PUBLIC EXECUTE and no
-- admin check inside:
--
--   admin_create_post, admin_update_post, admin_delete_post,
--   admin_upsert_setting
--
-- Each original is renamed to *_impl (body untouched, search_path
-- added), and a same-signature wrapper calls require_admin() first.
--
-- get_site_settings() is deliberately left public: it feeds the public
-- settings shown to every visitor. It only lacks search_path, which is
-- fixed here.

BEGIN;

-- 1) admin_create_post
ALTER FUNCTION public.admin_create_post(text,text,text,text,text,text,text,text[],text,text)
  RENAME TO admin_create_post_impl;
ALTER FUNCTION public.admin_create_post_impl(text,text,text,text,text,text,text,text[],text,text)
  SET search_path TO 'public';

CREATE FUNCTION public.admin_create_post(
  p_title text, p_slug text, p_content text, p_excerpt text,
  p_cover_image text, p_post_type text, p_status text, p_tags text[],
  p_meta_title text, p_meta_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN public.admin_create_post_impl(
    p_title, p_slug, p_content, p_excerpt, p_cover_image, p_post_type,
    p_status, p_tags, p_meta_title, p_meta_description
  );
END;
$$;

-- 2) admin_update_post
ALTER FUNCTION public.admin_update_post(uuid,text,text,text,text,text,text,text,text[],text,text)
  RENAME TO admin_update_post_impl;
ALTER FUNCTION public.admin_update_post_impl(uuid,text,text,text,text,text,text,text,text[],text,text)
  SET search_path TO 'public';

CREATE FUNCTION public.admin_update_post(
  p_post_id uuid, p_title text, p_slug text, p_content text, p_excerpt text,
  p_cover_image text, p_post_type text, p_status text, p_tags text[],
  p_meta_title text, p_meta_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  PERFORM public.admin_update_post_impl(
    p_post_id, p_title, p_slug, p_content, p_excerpt, p_cover_image,
    p_post_type, p_status, p_tags, p_meta_title, p_meta_description
  );
END;
$$;

-- 3) admin_delete_post
ALTER FUNCTION public.admin_delete_post(uuid) RENAME TO admin_delete_post_impl;
ALTER FUNCTION public.admin_delete_post_impl(uuid) SET search_path TO 'public';

CREATE FUNCTION public.admin_delete_post(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  PERFORM public.admin_delete_post_impl(p_post_id);
END;
$$;

-- 4) admin_upsert_setting
ALTER FUNCTION public.admin_upsert_setting(text,jsonb,text)
  RENAME TO admin_upsert_setting_impl;
ALTER FUNCTION public.admin_upsert_setting_impl(text,jsonb,text)
  SET search_path TO 'public';

CREATE FUNCTION public.admin_upsert_setting(p_key text, p_value jsonb, p_category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  PERFORM public.admin_upsert_setting_impl(p_key, p_value, p_category);
END;
$$;

-- 5) get_site_settings: public by design (visitor-facing settings feed),
--    only the missing search_path is fixed.
ALTER FUNCTION public.get_site_settings() SET search_path TO 'public';

-- 6) Permissions: impls are service-only, wrappers are for logged-in
--    users (require_admin() decides).
DO $$
DECLARE
  hidden text[] := ARRAY[
    'public.admin_create_post_impl(text,text,text,text,text,text,text,text[],text,text)',
    'public.admin_update_post_impl(uuid,text,text,text,text,text,text,text,text[],text,text)',
    'public.admin_delete_post_impl(uuid)',
    'public.admin_upsert_setting_impl(text,jsonb,text)'
  ];
  wrappers text[] := ARRAY[
    'public.admin_create_post(text,text,text,text,text,text,text,text[],text,text)',
    'public.admin_update_post(uuid,text,text,text,text,text,text,text,text[],text,text)',
    'public.admin_delete_post(uuid)',
    'public.admin_upsert_setting(text,jsonb,text)'
  ];
  fn text;
BEGIN
  FOREACH fn IN ARRAY hidden LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;

  FOREACH fn IN ARRAY wrappers LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
