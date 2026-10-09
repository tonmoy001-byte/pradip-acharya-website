CREATE OR REPLACE FUNCTION public.approve_order_payment(p_order_id uuid, p_payment_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_order record;
  v_event_id uuid;
  v_result jsonb;
  v_item record;
  v_token text;
  v_token_hash text;
  v_grant_id uuid;
  v_txn_id text;
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.payment_status = 'paid' AND v_order.payment_reference = p_payment_reference THEN
    SELECT jsonb_build_object(
      'order_id', v_order.id,
      'payment_status', v_order.payment_status,
      'message', 'Already approved'
    ) INTO v_result;
    RETURN v_result;
  END IF;

  IF v_order.payment_status NOT IN ('pending_payment', 'payment_review', 'pending_verification') THEN
    RAISE EXCEPTION 'Order cannot be approved in current status: %', v_order.payment_status;
  END IF;

  v_txn_id := COALESCE(NULLIF(p_payment_reference, ''), 'manual-' || p_order_id || '-' || extract(epoch from now())::bigint);

  INSERT INTO payment_events (provider, provider_transaction_id, order_id, status, verified, actor_id, raw_payload)
  VALUES ('manual', v_txn_id, p_order_id, 'approved', true, v_admin_id,
    jsonb_build_object('action', 'approve', 'admin_id', v_admin_id))
  ON CONFLICT (provider, provider_transaction_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT jsonb_build_object(
      'order_id', v_order.id,
      'payment_status', v_order.payment_status,
      'message', 'Event already recorded'
    ) INTO v_result;
    RETURN v_result;
  END IF;

  UPDATE orders
  SET payment_status = 'paid',
      payment_reference = p_payment_reference,
      payment_method = 'manual',
      paid_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  IF v_order.user_id IS NOT NULL THEN
    FOR v_item IN
      SELECT oi.id as item_id, oi.format_id, oi.delivery_type_snapshot
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.delivery_type_snapshot = 'digital'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM download_grants dg
        WHERE dg.order_item_id = v_item.item_id
          AND dg.user_id = v_order.user_id
      ) THEN
        v_token := encode(gen_random_bytes(32), 'hex');
        v_token_hash := encode(sha256(v_token::bytea), 'hex');

        INSERT INTO download_grants (
          order_id, order_item_id, user_id, token_hash, max_downloads, download_count, expires_at
        ) VALUES (
          p_order_id, v_item.item_id, v_order.user_id, v_token_hash, 5, 0,
          now() + interval '30 days'
        ) RETURNING id INTO v_grant_id;
      END IF;
    END LOOP;
  END IF;

  SELECT jsonb_build_object(
    'order_id', o.id,
    'payment_status', o.payment_status,
    'paid_at', o.paid_at,
    'message', 'Payment approved'
  )
  INTO v_result
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$function$;
