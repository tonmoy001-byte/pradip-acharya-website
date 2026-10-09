CREATE OR REPLACE FUNCTION public.reject_order_payment(p_order_id uuid, p_reason text)
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
BEGIN
  IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;

  SELECT * INTO v_order
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.payment_status NOT IN ('pending_payment', 'payment_review', 'pending_verification') THEN
    RAISE EXCEPTION 'Order cannot be rejected in current status: %', v_order.payment_status;
  END IF;

  INSERT INTO payment_events (provider, provider_transaction_id, order_id, status, verified, actor_id, raw_payload)
  VALUES ('manual', 'reject-' || p_order_id::text, p_order_id, 'rejected', false, v_admin_id,
    jsonb_build_object('action', 'reject', 'reason', p_reason, 'admin_id', v_admin_id))
  ON CONFLICT (provider, provider_transaction_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT jsonb_build_object('order_id', v_order.id, 'message', 'Already rejected') INTO v_result;
    RETURN v_result;
  END IF;

  UPDATE orders
  SET payment_status = 'failed',
      payment_method = 'manual',
      updated_at = now(),
      cancelled_at = now()
  WHERE id = p_order_id;

  SELECT jsonb_build_object('order_id', o.id, 'payment_status', o.payment_status, 'message', 'Payment rejected')
  INTO v_result FROM orders o WHERE o.id = p_order_id;

  RETURN v_result;
END;
$function$;
