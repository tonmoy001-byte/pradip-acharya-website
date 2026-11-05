// lib/siteUrl.ts
// Server-side only: canonical public origin used for payment gateway
// redirect/webhook URLs. Never import this in client components.

const raw = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
const url = raw.trim().replace(/\/+$/, "");

if (!url) {
  throw new Error("APP_URL is not set");
}
if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(url)) {
  throw new Error(`APP_URL must not point to localhost in production (got ${url})`);
}
if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
  throw new Error("APP_URL must use https in production");
}

export const SITE_URL = url;
export const absoluteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
