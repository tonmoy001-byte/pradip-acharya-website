// mcp-gsc/src/tools/sitemaps.ts
// MCP tools for managing Google Search Console sitemaps.

import { z } from "zod/v4"
import { getAuth, getDefaultSiteUrl } from "../auth.js"

const siteUrlSchema = z.string().optional().describe("Property URL (defaults to GSC_SITE_URL env var)")
const feedpathSchema = z.string().describe("Sitemap URL path")

// --- List Sitemaps ---

export const listSitemapsInputSchema = z.object({
  siteUrl: siteUrlSchema,
})

export async function listSitemaps(input: { siteUrl?: string }) {
  const auth = getAuth()
  const siteUrl = input.siteUrl || getDefaultSiteUrl()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    const res = await client.sitemaps.list({ siteUrl })
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(res.data.sitemap || [], null, 2),
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error listing sitemaps: ${message}` }],
      isError: true,
    }
  }
}

// --- Get Sitemap ---

export const getSitemapInputSchema = z.object({
  siteUrl: siteUrlSchema,
  feedpath: feedpathSchema,
})

export async function getSitemap(input: { siteUrl?: string; feedpath: string }) {
  const auth = getAuth()
  const siteUrl = input.siteUrl || getDefaultSiteUrl()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    const res = await client.sitemaps.get({ siteUrl, feedpath: input.feedpath })
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(res.data, null, 2),
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error getting sitemap: ${message}` }],
      isError: true,
    }
  }
}

// --- Submit Sitemap ---

export const submitSitemapInputSchema = z.object({
  siteUrl: siteUrlSchema,
  feedpath: feedpathSchema,
})

export async function submitSitemap(input: { siteUrl?: string; feedpath: string }) {
  const auth = getAuth()
  const siteUrl = input.siteUrl || getDefaultSiteUrl()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    await client.sitemaps.submit({ siteUrl, feedpath: input.feedpath })
    return {
      content: [{
        type: "text" as const,
        text: `Sitemap submitted successfully: ${input.feedpath}`,
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error submitting sitemap: ${message}` }],
      isError: true,
    }
  }
}

// --- Delete Sitemap ---

export const deleteSitemapInputSchema = z.object({
  siteUrl: siteUrlSchema,
  feedpath: feedpathSchema,
})

export async function deleteSitemap(input: { siteUrl?: string; feedpath: string }) {
  const auth = getAuth()
  const siteUrl = input.siteUrl || getDefaultSiteUrl()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    await client.sitemaps.delete({ siteUrl, feedpath: input.feedpath })
    return {
      content: [{
        type: "text" as const,
        text: `Sitemap deleted successfully: ${input.feedpath}`,
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error deleting sitemap: ${message}` }],
      isError: true,
    }
  }
}
