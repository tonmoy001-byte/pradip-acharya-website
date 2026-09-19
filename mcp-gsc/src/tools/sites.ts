// mcp-gsc/src/tools/sites.ts
// MCP tools for managing Google Search Console properties/sites.

import { z } from "zod/v4"
import { getAuth } from "../auth.js"

// --- List Sites ---

export const listSitesInputSchema = z.object({})

export async function listSites() {
  const auth = getAuth()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    const res = await client.sites.list()
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(res.data.siteEntry || [], null, 2),
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error listing sites: ${message}` }],
      isError: true,
    }
  }
}

// --- Add Site ---

export const addSiteInputSchema = z.object({
  siteUrl: z.string().describe("Property URL to add (domain or URL prefix)"),
})

export async function addSite(input: { siteUrl: string }) {
  const auth = getAuth()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    await client.sites.add({ siteUrl: input.siteUrl })
    return {
      content: [{
        type: "text" as const,
        text: `Site added successfully: ${input.siteUrl}`,
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error adding site: ${message}` }],
      isError: true,
    }
  }
}
