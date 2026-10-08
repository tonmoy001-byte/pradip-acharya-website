const BASE = "https://pradipbooks.insforge.site";
const pages = ["/", "/books", "/novels", "/book/chhera-pushpo", "/about", "/contact", "/privacy", "/blog"];
let fail = 0;
const bad = (m) => { fail++; console.log("  FAIL " + m); };
const good = (m) => console.log("  ok   " + m);

(async () => {
  console.log("== content renders ==");
  for (const p of pages) {
    const r = await fetch(BASE + p);
    const h = await r.text();
    if (r.status !== 200) { bad(`${p} -> ${r.status}`); continue; }
    const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    const h2 = (h.match(/<h2[\s>]/g) || []).length;
    const imgs = [...h.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    const noAlt = imgs.filter((t) => !/\balt=/.test(t));
    const emptyAlt = imgs.filter((t) => /alt=""/.test(t));
    const probs = [];
    if (!title.includes("প্রদীপ") && !title.includes("ছেঁড়া")) probs.push(`title="${title}"`);
    if (noAlt.length) probs.push(`${noAlt.length} img without alt`);
    if (emptyAlt.length) probs.push(`${emptyAlt.length} img with empty alt`);
    probs.length ? bad(`${p} :: ${probs.join(" | ")}`) : good(`${p}  h2=${h2}  imgs=${imgs.length} all with alt`);
  }

  console.log("== security boundaries ==");
  // POST-only endpoints answer 405 to a GET, which is correct — the 401 check
  // has to use the method the endpoint actually accepts.
  {
    const r = await fetch(BASE + "/api/my-downloads");
    r.status === 401 ? good("/api/my-downloads GET -> 401") : bad(`/api/my-downloads -> ${r.status}`);

    const o = await fetch(BASE + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    o.status === 401 ? good("/api/orders POST -> 401") : bad(`/api/orders POST -> ${o.status}`);

    const g = await fetch(BASE + "/api/orders");
    g.status === 405 ? good("/api/orders GET -> 405 (POST-only)") : bad(`/api/orders GET -> ${g.status}`);
  }
  {
    // The digital asset must not be fetchable without a grant.
    const key = encodeURIComponent("ছেঁড়া পুষ্প.pdf");
    const dl = await fetch(`https://cpd9mnqf.ap-southeast.insforge.app/api/storage/buckets/digital-books/objects/${key}`);
    [401, 403].includes(dl.status) ? good(`private bucket -> ${dl.status} (not public)`) : bad(`private bucket -> ${dl.status}`);
  }

  console.log("== book page content ==");
  {
    const h = await (await fetch(BASE + "/book/chhera-pushpo")).text();
    for (const [label, re] of [
      ["genre text", /সামাজিক উপন্যাস/],
      ["PDF/ইবুক format", /ইবুক \(PDF\)|ইবুক/],
      ["purchase steps heading", /ইবুক কীভাবে পাবেন/],
      ["author link to /about", /href="\/about"/],
      ["contact link", /href="\/contact"/],
      ["descriptive image alt", /alt="ছেঁড়া পুষ্প[^"]*"/],
    ]) {
      re.test(h) ? good(label) : bad(`missing: ${label}`);
    }
  }

  console.log("\n" + (fail === 0 ? "SMOKE TEST PASSED" : fail + " FAILURE(S)"));
  process.exit(fail === 0 ? 0 : 1);
})();
