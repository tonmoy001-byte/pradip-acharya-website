// Verifies the live deployment's SEO output end to end.
const BASE = "https://cpd9mnqf.insforge.site";

const PUBLIC = ["/", "/books", "/novels", "/book/chhera-pushpo", "/about", "/contact", "/privacy", "/blog"];
const PRIVATE = ["/login", "/checkout", "/account/orders", "/my-downloads", "/verify", "/payment/success", "/forgot-password"];

let failures = 0;
const fail = (m) => { failures++; console.log("  FAIL  " + m); };
const ok = (m) => console.log("  ok    " + m);

const pick = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

// Next.js normalises the root canonical to the bare origin with no trailing
// slash, which is the conventional form. Compare accordingly.
const norm = (u) => (u || "").replace(/\/+$/, "");

async function get(path) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return { status: res.status, html: await res.text(), headers: res.headers };
}

(async () => {
  console.log("== robots.txt ==");
  {
    const r = await fetch(BASE + "/robots.txt");
    const t = await r.text();
    if (r.status !== 200) fail(`status ${r.status}`);
    else ok("200");
    for (const line of ["Disallow: /admin", "Disallow: /checkout", "Disallow: /account", "Sitemap: " + BASE + "/sitemap.xml"]) {
      t.includes(line) ? ok(`has "${line}"`) : fail(`missing "${line}"`);
    }
    if (/localhost/.test(t)) fail("references localhost"); else ok("no localhost");
  }

  console.log("== sitemap.xml ==");
  {
    const r = await fetch(BASE + "/sitemap.xml");
    const t = await r.text();
    if (r.status !== 200) fail(`status ${r.status}`); else ok("200");
    if (/localhost/.test(t)) fail("references localhost"); else ok("no localhost");
    const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    ok(`${locs.length} URLs`);
    for (const p of ["/books", "/novels", "/book/chhera-pushpo", "/about"]) {
      locs.includes(BASE + p) ? ok(`includes ${p}`) : fail(`missing ${p}`);
    }
    for (const l of locs) {
      if (!l.startsWith("https://")) fail(`non-https loc: ${l}`);
    }
  }

  console.log("== public pages: canonical + og + h1 ==");
  for (const p of PUBLIC) {
    const { status, html } = await get(p);
    if (status !== 200) { fail(`${p} -> ${status}`); continue; }
    const canon = pick(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
    const ogUrl = pick(html, /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/);
    const ogImg = pick(html, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
    const twImg = pick(html, /<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/);
    const desc = pick(html, /<meta[^>]+name="description"[^>]+content="([^"]*)"/);
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html);
    const problems = [];
    if (canon !== norm(BASE + p)) problems.push(`canonical=${canon}`);
    if (ogUrl !== norm(BASE + p)) problems.push(`og:url=${ogUrl}`);
    if (!ogImg || !ogImg.startsWith("https://")) problems.push(`og:image=${ogImg}`);
    if (!twImg) problems.push("twitter:image missing");
    if (!desc || desc.length < 50) problems.push(`description too short (${desc ? desc.length : 0})`);
    if (h1 !== 1) problems.push(`h1 count=${h1}`);
    if (noindex) problems.push("unexpected noindex");
    problems.length ? fail(`${p} :: ${problems.join(" | ")}`) : ok(`${p} canonical+og+desc+h1`);
  }

  console.log("== private pages: noindex ==");
  for (const p of PRIVATE) {
    const { status, html, headers } = await get(p);
    if (status >= 400) { ok(`${p} -> ${status} (not crawlable)`); continue; }
    // The X-Robots-Tag header is the authoritative mechanism: /verify and
    // /payment/success are client-rendered and emit no server-side meta tag.
    const header = headers.get("x-robots-tag") || "";
    const noindex = /noindex/.test(header) ||
      /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(html);
    noindex ? ok(`${p} noindex (header: ${header || "meta"})`) : fail(`${p} missing noindex (status ${status})`);
  }

  console.log("== public pages carry no noindex header ==");
  for (const p of ["/", "/books", "/novels", "/book/chhera-pushpo", "/about", "/blog"]) {
    const { headers } = await get(p);
    const header = headers.get("x-robots-tag") || "";
    /noindex/.test(header) ? fail(`${p} incorrectly sends noindex`) : ok(`${p} indexable`);
  }

  console.log("== JSON-LD ==");
  for (const p of ["/", "/book/chhera-pushpo", "/about"]) {
    const { html } = await get(p);
    const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    if (!blocks.length) { fail(`${p} has no JSON-LD`); continue; }
    let allGood = true;
    for (const b of blocks) {
      try { JSON.parse(b[1]); } catch (e) { allGood = false; fail(`${p} JSON-LD parse error: ${e.message}`); }
    }
    if (allGood) ok(`${p} ${blocks.length} JSON-LD block(s) parse`);
  }

  console.log("== Book structured data details ==");
  {
    const { html } = await get("/book/chhera-pushpo");
    const b = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (b) {
      const d = JSON.parse(b[1]);
      const nodes = Array.isArray(d) ? d : d["@graph"] || [d];
      // The book node is typed ["Book", "Product"], so match on either.
      const book = nodes.find((n) => {
        const t = n["@type"];
        return Array.isArray(t) ? t.includes("Book") : t === "Book";
      });
      if (!book) fail("no Book node");
      else {
        const img = Array.isArray(book.image) ? book.image[0] : book.image;
        String(img).startsWith("https://") ? ok(`image absolute: ${img}`) : fail(`image not absolute: ${img}`);
        book.offers && book.offers.url ? ok(`offers.url: ${book.offers.url}`) : fail("offers.url missing");
        book.offers && book.offers.price ? ok(`price: ${book.offers.price} ${book.offers.priceCurrency}`) : fail("price missing");
        book.availabilityStarts ? fail(`junk availabilityStarts: ${book.availabilityStarts}`) : ok("no junk availabilityStarts");
        book.inLanguage ? ok(`inLanguage: ${book.inLanguage}`) : fail("inLanguage missing");
        // The author is a cross-page @id reference, not an inline copy; the
        // name itself is defined once on /about.
        book.author && (book.author["@id"] || book.author.name)
          ? ok(`author: ${book.author["@id"] || book.author.name}`)
          : fail("author missing");
        book.datePublished ? ok(`datePublished: ${book.datePublished}`) : fail("datePublished missing");
      }
    }
  }

  console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"));
  process.exit(failures === 0 ? 0 : 1);
})();
