// mcp-gsc/src/tools/inspect.ts
// MCP tool for inspecting URL index status in Google Search Console.

import { z } from "zod/v4"
import { getAuth, getDefaultSiteUrl } from "../auth.js"

export const inspectUrlInputSchema = z.object({
  siteUrl: z.string().optional().describe("Property URL (defaults to GSC_SITE_URL env var)"),
  inspectionUrl: z.string().describe("URL to inspect"),
  languageCode: z.string().optional().describe("Language code (default: en-US)"),
})

export async function inspectUrl(input: { siteUrl?: string; inspectionUrl: string; languageCode?: string }) {
  const auth = getAuth()
  const siteUrl = input.siteUrl || getDefaultSiteUrl()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  try {
    const res = await client.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: input.inspectionUrl,
        siteUrl,
        languageCode: input.languageCode || "en-US",
      },
    })

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(res.data, null, 2),
      }],
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: "text" as const, text: `Error inspecting URL: ${message}` }],
      isError: true,
    }
  }
}
