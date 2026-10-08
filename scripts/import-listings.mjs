#!/usr/bin/env node

/**
 * listings-import.mjs
 *
 * Imports a CSV of book listings, optimizes images with sharp,
 * and regenerates lib/generated-books.ts.
 *
 * Usage: node scripts/import-listings.mjs
 *
 * Reads: incoming/listings.csv, incoming/images/*
 * Writes: public/images/books/*.jpg, lib/generated-books.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { parse } from "node:path"

// ── Config ──────────────────────────────────────────────────────────
const PROJECT_ROOT = process.cwd()
const INCOMING_DIR = join(PROJECT_ROOT, "incoming")
const CSV_PATH = join(INCOMING_DIR, "listings.csv")
const IMAGES_DIR = join(INCOMING_DIR, "images")
const OUTPUT_IMAGES_DIR = join(PROJECT_ROOT, "public", "images", "books")
const OUTPUT_TS = join(PROJECT_ROOT, "lib", "generated-books.ts")
const PLACEHOLDER_SVG = "/images/book-placeholder.svg"

// ── CSV Parser (quote-aware) ────────────────────────────────────────
function parseCSV(text) {
  const lines = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "\n" && !inQuotes) {
      lines.push(current)
      current = ""
    } else if (ch === "\r" && !inQuotes) {
      // skip \r, handle \r\n
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)

  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = lines[i].split(",").map((v) => v.trim())
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ""
    })
    rows.push(row)
  }

  return rows
}

// ── Slug generator ──────────────────────────────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u0980-\u09FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
}

// ── Base book IDs (from lib/data.ts) ────────────────────────────────
const BASE_IDS = new Set(["chhera-pushpo", "demo-poetry-1", "demo-novel-1"])

// ── Image optimizer (sharp) ─────────────────────────────────────────
async function optimizeImage(srcPath, destPath) {
  let sharp
  try {
    sharp = (await import("sharp")).default
  } catch {
    console.warn("  ⚠ sharp not available, copying original")
    copyFileSync(srcPath, destPath)
    return
  }

  try {
    await sharp(srcPath)
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(destPath)
    console.log(`  ✓ Optimized: ${basename(destPath)}`)
  } catch (err) {
    console.warn(`  ⚠ Failed to optimize ${basename(srcPath)}: ${err.message}`)
    copyFileSync(srcPath, destPath)
  }
}

async function downloadAndOptimize(url, destPath) {
  let sharp
  try {
    sharp = (await import("sharp")).default
  } catch {
    console.warn("  ⚠ sharp not available, skipping download")
    return
  }

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    await sharp(buffer)
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(destPath)
    console.log(`  ✓ Downloaded & optimized: ${basename(destPath)}`)
  } catch (err) {
    console.warn(`  ⚠ Failed to download ${url}: ${err.message}`)
  }
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error("❌ No incoming/listings.csv found. Copy listings-template.csv and add your data.")
    process.exit(1)
  }

  console.log("📚 Importing listings from incoming/listings.csv...\n")

  const csvText = readFileSync(CSV_PATH, "utf-8")
  const rows = parseCSV(csvText)

  if (rows.length === 0) {
    console.error("❌ No data rows found in CSV.")
    process.exit(1)
  }

  console.log(`  Found ${rows.length} row(s) in CSV\n`)

  // Ensure output dirs exist
  if (!existsSync(OUTPUT_IMAGES_DIR)) {
    mkdirSync(OUTPUT_IMAGES_DIR, { recursive: true })
  }

  // Group rows by title (multi-format books)
  const grouped = new Map()
  for (const row of rows) {
    const key = row.title
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key).push(row)
  }

  const books = []
  const usedIds = new Set(BASE_IDS)

  for (const [title, formatRows] of grouped) {
    const first = formatRows[0]
    let id = slugify(title)
    if (usedIds.has(id)) {
      let suffix = 2
      while (usedIds.has(`${id}-${suffix}`)) suffix++
      id = `${id}-${suffix}`
    }
    usedIds.add(id)

    console.log(`📖 ${title} (id: ${id})`)

    // Validate required fields
    if (!first.author || !first.category || !first.price) {
      console.error(`  ❌ Missing required fields (author, category, price). Skipping.\n`)
      continue
    }

    // Process images
    const images = { primary: "" }

    for (const [idx, imgField] of ["image1", "image2"].entries()) {
      const imgUrl = formatRows[0][imgField]
      if (!imgUrl) continue

      const outName = idx === 0 ? `${id}-1.jpg` : `${id}-2.jpg`
      const outPath = join(OUTPUT_IMAGES_DIR, outName)

      if (imgUrl.startsWith("http")) {
        await downloadAndOptimize(imgUrl, outPath)
      } else if (existsSync(imgUrl)) {
        await optimizeImage(imgUrl, outPath)
      } else if (existsSync(join(IMAGES_DIR, imgUrl))) {
        await optimizeImage(join(IMAGES_DIR, imgUrl), outPath)
      } else {
        console.warn(`  ⚠ Image not found: ${imgUrl}. Using placeholder.`)
      }

      if (existsSync(outPath)) {
        if (idx === 0) images.primary = `/images/books/${outName}`
        else images.hover = `/images/books/${outName}`
      }
    }

    if (!images.primary) {
      images.primary = PLACEHOLDER_SVG
      console.warn(`  ⚠ No images found, using placeholder`)
    }

    // Ebook-only store: one digital format per title, priced from the
    // cheapest source row. Paperbook rows are intentionally not imported.
    const cheapest = formatRows.reduce(
      (min, r) => (Number(r.price) < Number(min.price) ? r : min),
      formatRows[0],
    )

    const formats = [
      {
        name: "eBook",
        price: Number(cheapest.price) || 0,
        compareAtPrice: cheapest.compareAtPrice ? Number(cheapest.compareAtPrice) : undefined,
        delivery_type: "digital",
        available: true,
      },
    ]

    const book = {
      id,
      title,
      author: first.author,
      category: first.category,
      subcategory: first.subcategory || "",
      subcategorySlug: first.subcategorySlug || "",
      description: first.description || "",
      synopsis: first.synopsis || undefined,
      formats,
      publicationDate: first.publicationDate || undefined,
      publisher: first.publisher || undefined,
      isbn: first.isbn || undefined,
      pages: first.pages ? Number(first.pages) : undefined,
      language: first.language || undefined,
      images,
      featured: false,
      isNew: true,
      trending: false,
    }

    books.push(book)
    console.log(`  ✓ Added with ${formats.length} format(s)\n`)
  }

  // Generate TypeScript
  const ts = `// Auto-generated by scripts/import-listings.mjs. Do not hand-edit.
import type { Book } from "./data"
export const generatedBooks: Book[] = ${JSON.stringify(books, null, 2)}
`

  writeFileSync(OUTPUT_TS, ts, "utf-8")
  console.log(`\n✅ Generated lib/generated-books.ts with ${books.length} book(s)`)
}

main().catch((err) => {
  console.error("❌ Import failed:", err.message)
  process.exit(1)
})
