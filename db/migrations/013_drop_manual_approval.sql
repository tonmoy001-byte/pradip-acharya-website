-- Manual admin approval of payments was removed. Payment is confirmed only by the gateway
-- (/api/payment/verify and /api/payment/webhook); fulfill_paid_order (012) issues the downloads.
-- Apply only AFTER 012. Historical payment_events rows with provider 'manual' are kept.
DROP FUNCTION IF EXISTS public.approve_order_payment(uuid, text);
DROP FUNCTION IF EXISTS public.reject_order_payment(uuid, text);