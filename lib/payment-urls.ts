import { absoluteUrl } from "./siteUrl";

export const paymentUrls = (orderId: string) => ({
  success: absoluteUrl(`/payment/success?order_id=${encodeURIComponent(orderId)}`),
  cancel: absoluteUrl(`/payment/cancel?order_id=${encodeURIComponent(orderId)}`),
  webhook: absoluteUrl(`/api/payment/webhook`),
});
