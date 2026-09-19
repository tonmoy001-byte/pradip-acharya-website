// mcp-gsc/src/tools/analytics.ts
// MCP tool for querying Google Search Console search analytics.

import { z } from "zod/v4"
import { getAuth, getDefaultSiteUrl } from "../auth.js"

const analyticsInputSchema = z.object({
  siteUrl: z.string().optional().describe("Property URL (defaults to GSC_SITE_URL env var)"),
  startDate: z.string().describe("Start date in YYYY-MM-DD format, up to 3 months ago"),
  endDate: z.string().describe("End date in YYYY-MM-DD format, up to yesterday"),
  dimensions: z.array(z.string()).optional().describe("Grouping dimensions: query, page, country, device, date"),
  rowLimit: z.number().optional().describe("Max rows to return (default 100, max 25000)"),
  startRow: z.number().optional().describe("Offset for pagination"),
  searchType: z.enum(["web", "image", "video", "news"]).optional().describe("Search type filter"),
})

type AnalyticsInput = z.infer<typeof analyticsInputSchema>

export async function searchAnalytics(input: AnalyticsInput) {
  const auth = getAuth()
  const siteUrl = input.siteUrl || getDefaultSiteUrl()

  const { searchconsole } = await import("@googleapis/searchconsole")
  const client = searchconsole({ version: "v1", auth: auth as any })

  const requestBody: Record<string, unknown> = {
    startDate: input.startDate,
    endDate: input.endDate,
  }

  if (input.dimensions) requestBody.dimensions = input.dimensions
  if (input.rowLimit) requestBody.rowLimit = input.rowLimit
  if (input.startRow) requestBody.startRow = input.startRow
  if (input.searchType) requestBody.searchType = input.searchType

  try {
    const res = await client.searchanalytics.query({
      siteUrl,
      requestBody,
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
      content: [{
        type: "text" as const,
        text: `Error querying search analytics: ${message}`,
      }],
      isError: true,
    }
  }
}

export { analyticsInputSchema }
