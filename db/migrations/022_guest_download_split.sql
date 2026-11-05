-- 022_guest_download_split.sql
-- Split the guest download counter so a storage failure does not waste a count.
--
-- authorize_guest_download: same validation as consume_guest_download, returns
--   the storage_key, but does NOT increment and does NOT lock the row.
-- record_guest_download: atomic increment, safe under concurrency.
--
-- consume_guest_download is intentionally left in place until the route is
-- switched and verified; it can be dropped in a later migration.

BEGIN;

DROP FUNCTION IF EXISTS public.authorize_guest_download(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.authorize_guest_download(
  p_grant_id uuid,
  p_order_id uuid,
  p_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_grant  record;
  v_order  record;
  v_asset  record;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT dg.*, oi.format_id, oi.title_snapshot
    INTO v_grant
    FROM download_grants dg
    JOIN order_items oi ON oi.id = dg.order_item_id
   WHERE dg.id = p_grant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_grant.user_id IS NOT NULL OR v_grant.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_grant.order_id <> p_order_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_grant.order_id;
  IF NOT FOUND
     OR v_order.user_id IS NOT NULL
     OR v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_order.guest_token_hash = p_token_hash, false) IS NOT TRUE
     AND COALESCE(v_order.guest_email_token_hash = p_token_hash, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT da.* INTO v_asset
    FROM digital_assets da
   WHERE da.format_id = v_grant.format_id
     AND da.active = true
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object('storage_key', v_asset.storage_key, 'title', v_grant.title_snapshot);
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_guest_download(p_grant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE download_grants
     SET download_count = download_count + 1,
         last_downloaded_at = now()
   WHERE id = p_grant_id;
END;
$function$;

-- Permissions
REVOKE ALL ON FUNCTION public.authorize_guest_download(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_guest_download(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.authorize_guest_download(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_guest_download(uuid, uuid, text) TO project_admin;

REVOKE ALL ON FUNCTION public.record_guest_download(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_guest_download(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.record_guest_download(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_guest_download(uuid) TO project_admin;

COMMIT;

NOTIFY pgrst, 'reload schema';