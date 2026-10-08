const fs = require("fs");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const { InsForge } = require("@insforge/sdk");

const client = new InsForge({
  baseUrl: env.NEXT_PUBLIC_INSFORGE_URL,
  apiKey: env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
});

(async () => {
  for (let i = 1; i <= 10; i++) {
    try {
      const { data, error } = await client.database
        .from("books")
        .select("*, book_formats(*)")
        .eq("id", "chhera-pushpo")
        .single();
      console.log(`${i}: ERROR=${error ? JSON.stringify(error).slice(0, 150) : "null"} data=${data ? "yes" : "no"} formats=${data && data.book_formats ? data.book_formats.length : "n/a"}`);
    } catch (e) {
      console.log(`${i}: THROWN ${e.message.slice(0, 150)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
})();
