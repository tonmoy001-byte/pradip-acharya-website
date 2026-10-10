-- 015_lock-down-admin-functions.sql
--
-- Closes the biggest hole in the database: the SECURITY DEFINER admin
-- book functions never checked who called them, and nobody had revoked
-- PUBLIC EXECUTE. The public anon key ships in every browser, so anyone
-- could call admin_create_book / admin_update_book / admin_delete_book
-- straight through the RPC endpoint and skip requireAdmin() in the
-- Next.js routes.
--
-- Strategy: rename each original function to *_impl (body untouched),
-- hide the _impl function from API callers, and create a new function
-- with the SAME name and argument types that checks require_admin()
-- first. No application code changes are needed for the book functions.
--
-- Also in this migration:
--   * fulfill_paid_order: revoked from every application role except the
--     service role (project_admin here — the InsForge service key maps to
--     it). The payment gateway is the only thing allowed to release
--     files. Its default payment_method is corrected from the legacy
--     'rupantor' to 'nagorikpay' (RupantorPay was removed from the app).
--   * create_order_from_cart: legacy, unused by the app. It is dangerous
--     (client-supplied format_id, creates download grants BEFORE payment)
--     and is revoked from every role. Do not call it.
--   * Every other SECURITY DEFINER function gets an explicit
--     search_path=public (the classic SECURITY DEFINER poisoning fix).

BEGIN;

-- 1) Reusable guard: raises unless the caller is a verified admin.
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 2) Rename the originals so their bodies stay exactly as they are.
ALTER FUNCTION public.admin_create_book(
  text, text, text, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, jsonb
) RENAME TO admin_create_book_impl;

ALTER FUNCTION public.admin_update_book(
  text, text, text, text, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, jsonb
) RENAME TO admin_update_book_impl;

ALTER FUNCTION public.admin_delete_book(text) RENAME TO admin_delete_book_impl;

-- 3) Public-facing functions with the same signatures that check admin first.
CREATE FUNCTION public.admin_create_book(
  p_title text, p_author text, p_category text, p_subcategory text,
  p_subcategory_slug text, p_description text, p_synopsis text,
  p_cover_primary text, p_cover_hover text,
  p_featured boolean, p_is_new boolean, p_trending boolean, p_is_demo boolean,
  p_formats jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN public.admin_create_book_impl(
    p_title, p_author, p_category, p_subcategory, p_subcategory_slug,
    p_description, p_synopsis, p_cover_primary, p_cover_hover,
    p_featured, p_is_new, p_trending, p_is_demo, p_formats
  );
END;
$$;

CREATE FUNCTION public.admin_update_book(
  p_book_id text, p_title text, p_author text, p_category text,
  p_subcategory text, p_subcategory_slug text, p_description text,
  p_synopsis text, p_cover_primary text, p_cover_hover text,
  p_featured boolean, p_is_new boolean, p_trending boolean, p_is_demo boolean,
  p_formats jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  PERFORM public.admin_update_book_impl(
    p_book_id, p_title, p_author, p_category, p_subcategory, p_subcategory_slug,
    p_description, p_synopsis, p_cover_primary, p_cover_hover,
    p_featured, p_is_new, p_trending, p_is_demo, p_formats
  );
END;
$$;

CREATE FUNCTION public.admin_delete_book(p_book_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.require_admin();
  PERFORM public.admin_delete_book_impl(p_book_id);
END;
$$;

-- 4) fulfill_paid_order: same body as before, except the legacy
--    'rupantor' default payment_method is now 'nagorikpay'.
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order_id uuid, p_payment_reference text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_item record;
  v_token text;
  v_grant_id uuid;
  v_created integer := 0;
  v_grants jsonb := '[]'::jsonb;
begin
  -- Lock the order so a concurrent verify/webhook cannot double-grant.
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- The payment gateway is the gate, not a human. This function only ever
  -- releases files for an order the server has already confirmed as paid, so it
  -- is safe to call from the verify/webhook handlers without an admin step.
  if v_order.payment_status <> 'paid' then
    raise exception 'Order is not paid (current status: %)', v_order.payment_status;
  end if;

  if p_payment_reference is not null and v_order.payment_reference is distinct from p_payment_reference then
    update orders
       set payment_reference = p_payment_reference,
           payment_method    = coalesce(payment_method, 'nagorikpay'),
           paid_at           = coalesce(paid_at, now()),
           updated_at        = now()
     where id = p_order_id;
  else
    update orders
       set paid_at    = coalesce(paid_at, now()),
           updated_at = now()
     where id = p_order_id;
  end if;

  for v_item in
    select oi.id as item_id
    from order_items oi
    where oi.order_id = p_order_id
      and oi.delivery_type_snapshot = 'digital'
  loop
    -- Idempotent: one grant per order line, re-running is a no-op.
    if v_order.user_id is not null and not exists (
      select 1 from download_grants dg
      where dg.order_item_id = v_item.item_id
        and dg.user_id = v_order.user_id
    ) then
      v_token := encode(gen_random_bytes(32), 'hex');

      insert into download_grants (
        order_id, order_item_id, user_id, token_hash,
        max_downloads, download_count, expires_at
      ) values (
        p_order_id, v_item.item_id, v_order.user_id,
        encode(sha256(v_token::bytea), 'hex'),
        5, 0, now() + interval '30 days'
      )
      returning id into v_grant_id;

      v_created := v_created + 1;
      v_grants := v_grants || jsonb_build_object('order_item_id', v_item.item_id, 'grant_id', v_grant_id);
    end if;
  end loop;

  return jsonb_build_object(
    'order_id',      p_order_id,
    'payment_status','paid',
    'grants_created',v_created,
    'grants',        v_grants,
    'ready',         true
  );
end;
$function$;

-- 5) Explicit search_path on every remaining SECURITY DEFINER function
--    (metadata-only change; bodies untouched).
ALTER FUNCTION public.generate_token_hash() SET search_path TO 'public';
ALTER FUNCTION public.consume_download(uuid) SET search_path TO 'public';
ALTER FUNCTION public.consume_download(uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.set_default_address(uuid) SET search_path TO 'public';
ALTER FUNCTION public.toggle_wishlist(text) SET search_path TO 'public';
ALTER FUNCTION public.toggle_wishlist(uuid, text) SET search_path TO 'public';
ALTER FUNCTION public.is_in_wishlist(text) SET search_path TO 'public';
ALTER FUNCTION public.get_user_profile() SET search_path TO 'public';
ALTER FUNCTION public.get_user_profile(uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_wishlist(uuid) SET search_path TO 'public';
ALTER FUNCTION public.upsert_profile(uuid, text, text) SET search_path TO 'public';
ALTER FUNCTION public.get_user_orders(uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_user_order_detail(uuid, uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_order_items(uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_user_downloads(uuid) SET search_path TO 'public';

-- 6) Permissions.
--    _impl functions, fulfill_paid_order and create_order_from_cart are
--    service-only: nobody calls them over the API with a browser key.
--    Public wrappers: only logged-in users can reach them (and then
--    require_admin() decides).
DO $$
DECLARE
  hidden text[] := ARRAY[
    'public.admin_create_book_impl(text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,jsonb)',
    'public.admin_update_book_impl(text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,jsonb)',
    'public.admin_delete_book_impl(text)',
    'public.fulfill_paid_order(uuid,text)',
    'public.create_order_from_cart(jsonb,jsonb,jsonb)'
  ];
  wrappers text[] := ARRAY[
    'public.admin_create_book(text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,jsonb)',
    'public.admin_update_book(text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,jsonb)',
    'public.admin_delete_book(text)'
  ];
  fn text;
  r  text;
BEGIN
  FOREACH fn IN ARRAY hidden LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn, r);
      END IF;
    END LOOP;
  END LOOP;

  FOREACH fn IN ARRAY wrappers LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    END IF;
  END LOOP;

  -- The service key must still be able to run fulfill_paid_order.
  -- The InsForge service key maps to project_admin on this project.
  FOREACH r IN ARRAY ARRAY['project_admin','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.fulfill_paid_order(uuid,text) TO %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_admin() TO authenticated;

COMMIT;

-- Make the API pick up the renamed functions (ignore if your platform does this automatically).
NOTIFY pgrst, 'reload schema';
