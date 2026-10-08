import type { NextConfig } from "next";

function insforgeImagePattern() {
  const raw = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return {
      protocol: (u.protocol.replace(":", "") as "http" | "https"),
      hostname: u.hostname,
      port: u.port || "",
      pathname: "/api/storage/buckets/**",
    } as const;
  } catch {
    return null;
  }
}

const insforgePattern = insforgeImagePattern();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: insforgePattern ? [insforgePattern] : [],
  },
};

export default nextConfig;
