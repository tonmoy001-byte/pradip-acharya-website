// mcp-gsc/src/server.ts
// MCP server factory — creates McpServer and registers all GSC tools.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { searchAnalytics, analyticsInputSchema } from "./tools/analytics.js"
import {
  listSitemaps, listSitemapsInputSchema,
  getSitemap, getSitemapInputSchema,
  submitSitemap, submitSitemapInputSchema,
  deleteSitemap, deleteSitemapInputSchema,
} from "./tools/sitemaps.js"
import {
  listSites, listSitesInputSchema,
  addSite, addSiteInputSchema,
} from "./tools/sites.js"
import {
  inspectUrl, inspectUrlInputSchema,
} from "./tools/inspect.js"

export function createServer(): McpServer {
  const server = new McpServer({
    name: "gsc-mcp-server",
    version: "1.0.0",
  })

  // Register all 8 tools using the non-deprecated registerTool API
  server.registerTool("gsc_search_analytics", {
    description: "Query Google Search Console search analytics (clicks, impressions, CTR, position) filtered by date range, dimensions, and more.",
    inputSchema: analyticsInputSchema,
  }, async (args) => searchAnalytics(args))

  server.registerTool("gsc_list_sitemaps", {
    description: "List all submitted sitemaps for a Search Console property.",
    inputSchema: listSitemapsInputSchema,
  }, async (args) => listSitemaps(args))

  server.registerTool("gsc_get_sitemap", {
    description: "Get details of a specific sitemap including contained URLs.",
    inputSchema: getSitemapInputSchema,
  }, async (args) => getSitemap(args))

  server.registerTool("gsc_submit_sitemap", {
    description: "Submit a sitemap URL to Google Search Console.",
    inputSchema: submitSitemapInputSchema,
  }, async (args) => submitSitemap(args))

  server.registerTool("gsc_delete_sitemap", {
    description: "Remove a sitemap from Google Search Console.",
    inputSchema: deleteSitemapInputSchema,
  }, async (args) => deleteSitemap(args))

  server.registerTool("gsc_list_sites", {
    description: "List all verified properties in the Search Console account.",
    inputSchema: listSitesInputSchema,
  }, async (args) => listSites())

  server.registerTool("gsc_add_site", {
    description: "Add a new property (domain or URL prefix) to Search Console.",
    inputSchema: addSiteInputSchema,
  }, async (args) => addSite(args))

  server.registerTool("gsc_inspect_url", {
    description: "Inspect a URL's Google index status (coverage, verdict, robots.txt, page fetch state).",
    inputSchema: inspectUrlInputSchema,
  }, async (args) => inspectUrl(args))

  return server
}
