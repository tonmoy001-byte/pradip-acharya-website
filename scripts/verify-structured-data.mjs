// Validates the JSON-LD that production actually serves.
const BASE = process.env.SITE_URL ?? "https://pradipbooks.insforge.site";
const PAGES = ["/", "/books", "/novels", "/book/chhera-pushpo", "/about", "/contact", "/privacy", "/blog"];

let failures = 0;
const fail = (m) => { failures++; console.log("  FAIL  " + m); };
const ok = (m) => console.log("  ok    " + m);

const graphs = (html) =>
  [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try { return JSON.parse(m[1]); } catch (e) { return { __error: e.message, __raw: m[1].slice(0, 200) }; }
    });

const findType = (g, type) =>
  (g["@graph"] || [g]).find((n) => {
    const t = n["@type"];
    return Array.isArray(t) ? t.includes(type) : t === type;
  });

(async () => {
  console.log("== every page: JSON-LD parses ==");
  const cache = {};
  for (const p of PAGES) {
    const r = await fetch(BASE + p);
    const html = await r.text();
    const gs = graphs(html);
    cache[p] = { html, gs };
    if (!gs.length) { fail(`${p} emits no JSON-LD`); continue; }
    const bad = gs.filter((g) => g.__error);
    if (bad.length) { fail(`${p} parse error: ${bad[0].__error} :: ${bad[0].__raw}`); continue; }
    for (const g of gs) {
      if (g["@context"] !== "https://schema.org") fail(`${p} @context=${g["@context"]}`);
    }
    const types = gs.flatMap((g) => (g["@graph"] || [g]).map((n) => n["@type"]));
    ok(`${p}  [${types.join(", ")}]`);
  }

  console.log("== breadcrumbs on subpages ==");
  for (const p of ["/books", "/novels", "/book/chhera-pushpo", "/about", "/contact", "/privacy", "/blog"]) {
    const gs = cache[p]?.gs || [];
    const bc = gs.map((g) => findType(g, "BreadcrumbList")).find(Boolean);
    if (!bc) { fail(`${p} has no BreadcrumbList`); continue; }
    const items = bc.itemListElement;
    const positions = items.map((i) => i.position);
    const sequential = positions.every((v, i) => v === i + 1);
    const lastHasItem = "item" in items[items.length - 1];
    const allAbsolute = items.filter((i) => i.item).every((i) => i.item.startsWith("https://"));
    if (!sequential) fail(`${p} positions not sequential: ${positions}`);
    else if (lastHasItem) fail(`${p} trailing crumb has item (duplicate of page url)`);
    else if (!allAbsolute) fail(`${p} has a relative crumb url`);
    else ok(`${p}  ${items.map((i) => i.name).join(" › ")}`);
  }

  console.log("== Book node ==");
  {
    const gs = cache["/book/chhera-pushpo"].gs;
    const b = gs.map((g) => findType(g, "Book")).find(Boolean);
    if (!b) fail("no Book node");
    else {
      ok(`types: ${JSON.stringify(b["@type"])}`);
      ok(`@id: ${b["@id"]}`);
      b.alternateName === "Chhera Pushpo" ? ok(`alternateName: ${b.alternateName}`) : fail(`alternateName=${b.alternateName}`);
      b.isbn === "978-984-8846-47-6" ? ok(`isbn: ${b.isbn}`) : fail(`isbn=${b.isbn}`);
      b.publisher?.name === "স্বরাজ প্রকাশনী" ? ok(`publisher trimmed: "${b.publisher.name}"`) : fail(`publisher="${b.publisher?.name}"`);
      b.datePublished === "2012-04-14" ? ok(`datePublished: ${b.datePublished}`) : fail(`datePublished=${b.datePublished}`);
      b.numberOfPages === 90 ? ok(`numberOfPages: ${b.numberOfPages}`) : fail(`pages=${b.numberOfPages}`);
      b.genre === "উপন্যাস" ? ok(`genre (from DB): ${b.genre}`) : fail(`genre=${b.genre}`);
      b.isAccessibleForFree === false ? ok("isAccessibleForFree: false") : fail("isAccessibleForFree wrong");
      b.hasDigitalDocumentPublished ? ok(`hasDigitalDocumentPublished: ${b.hasDigitalDocumentPublished.encodingFormat}`) : fail("missing hasDigitalDocumentPublished");
      b.isbn && !b.isbn.includes("undefined") ? ok("no undefined leaking into isbn") : fail("undefined in output");
      b.offers?.price === "50" && b.offers?.priceCurrency === "BDT" ? ok(`offer: ${b.offers.price} ${b.offers.priceCurrency}`) : fail(`offer=${JSON.stringify(b.offers?.price)}`);
      b.offers?.priceValidUntil === undefined ? ok("no invented priceValidUntil") : fail("priceValidUntil fabricated");
      b.aggregateRating === undefined && b.review === undefined ? ok("no fabricated rating/review") : fail("fabricated rating/review present");
    }
  }

  console.log("== cross-entity references resolve ==");
  {
    const authorId = `${BASE}/about#person`;
    const websiteId = `${BASE}/#website`;
    const bookGraphs = cache["/book/chhera-pushpo"].gs;
    const book = bookGraphs.map((g) => findType(g, "Book")).find(Boolean);
    const webpage = bookGraphs.map((g) => findType(g, "WebPage")).find(Boolean);

    JSON.stringify(book.author) === JSON.stringify({ "@id": authorId })
      ? ok("book.author -> #person")
      : fail(`book.author=${JSON.stringify(book.author)}`);

    webpage?.mainEntity?.["@id"] === book["@id"] ? ok("WebPage.mainEntity -> book") : fail(`mainEntity=${JSON.stringify(webpage?.mainEntity)}`);

    // The about page must define the exact id the book page references.
    const aboutPerson = cache["/about"].gs.map((g) => findType(g, "Person")).find(Boolean);
    aboutPerson?.["@id"] === authorId ? ok("/about Person @id matches") : fail(`/about Person @id=${aboutPerson?.["@id"]}`);

    const homeSite = cache["/"].gs.map((g) => findType(g, "WebSite")).find(Boolean);
    homeSite?.["@id"] === websiteId ? ok("/ WebSite @id matches isPartOf") : fail(`WebSite @id=${homeSite?.["@id"]}`);
  }

  console.log("== deliberate omissions ==");
  {
    const aboutPerson = cache["/about"].gs.map((g) => findType(g, "Person")).find(Boolean);
    !("sameAs" in aboutPerson) ? ok("no fabricated sameAs") : fail(`sameAs=${JSON.stringify(aboutPerson.sameAs)}`);
    const homeSite = cache["/"].gs.map((g) => findType(g, "WebSite")).find(Boolean);
    !homeSite.potentialAction ? ok("no SearchAction (site has no /search)") : fail("SearchAction advertised without a search page");
    const org = cache["/"].gs.map((g) => findType(g, "Organization")).find(Boolean);
    !org?.logo ? ok("no fake logo") : fail(`logo=${JSON.stringify(org.logo)}`);
  }

  console.log("== no relative urls anywhere ==");
  {
    let checked = 0;
    for (const [p, { gs }] of Object.entries(cache)) {
      const s = JSON.stringify(gs);
      checked++;
      const rel = s.match(/"(?:url|item|contentUrl|image|logo|@id)":\s*"\/(?!\/)/g);
      if (rel) fail(`${p} has relative urls: ${rel.slice(0, 3)}`);
      if (s.includes("undefined")) fail(`${p} has the literal "undefined"`);
      if (s.includes("localhost")) fail(`${p} references localhost`);
    }
    ok(`${checked} page(s) clean`);
  }

  console.log("\n" + (failures === 0 ? "STRUCTURED DATA VALID" : failures + " FAILURE(S)"));
  process.exit(failures === 0 ? 0 : 1);
})();