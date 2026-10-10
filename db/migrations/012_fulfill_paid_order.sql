-- 012_fulfill_paid_order.sql
-- Called by /api/payment/verify and /api/payment/webhook after an order is marked paid.
-- Idempotent: safe to call repeatedly; creates at most one grant per digital order item.
-- Captured from production on 2026-10-10 (template-based; apply only if function missing).
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order_id uuid, p_payment_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order   record;
  v_item    record;
  v_created int := 0;
  v_total   int := 0;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Never grant files for an unpaid order, whoever calls this.
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Order is not paid (status: %)', v_order.payment_status;
  END IF;

  IF v_order.user_id IS NULL THEN
    RETURN jsonb_build_object('order_id', v_order.id, 'download_ready', false,
                              'message', 'Order has no owner');
  END IF;

  FOR v_item IN
    SELECT oi.id AS item_id
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.delivery_type_snapshot = 'digital'
  LOOP
    v_total := v_total + 1;
    IF NOT EXISTS (
      SELECT 1 FROM download_grants dg
      WHERE dg.order_item_id = v_item.item_id AND dg.user_id = v_order.user_id
    ) THEN
      INSERT INTO download_grants (
        order_id, order_item_id, user_id, token_hash, max_downloads, download_count, expires_at
      ) VALUES (
        p_order_id, v_item.item_id, v_order.user_id,
        encode(sha256(encode(gen_random_bytes(32), 'hex')::bytea), 'hex'),
        5, 0, now() + interval '30 days'
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'download_ready', v_total > 0,
    'grants_created', v_created,
    'message', 'Fulfilled'
  );
END;
$function$;