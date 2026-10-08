import fs from "node:fs";
import { createClient } from "@insforge/sdk";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const client = createClient({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
});

for (let i = 1; i <= 8; i++) {
  const t0 = Date.now();
  try {
    const { data, error } = await client.database
      .from("books")
      .select("*, book_formats(*)")
      .eq("id", "chhera-pushpo")
      .single();
    console.log(`${i}: ${Date.now() - t0}ms error=${error ? JSON.stringify(error).slice(0, 200) : "null"} data=${data ? "yes row=" + data.id : "no"}`);
  } catch (e) {
    console.log(`${i}: ${Date.now() - t0}ms THROWN ${String(e && e.message ? e.message : e).slice(0, 200)}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
