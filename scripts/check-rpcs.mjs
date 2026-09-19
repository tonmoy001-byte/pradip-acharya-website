import { createClient } from "@insforge/sdk"

const client = createClient({
  baseUrl: "https://cpd9mnqf.ap-southeast.insforge.app",
  anonKey: "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2",
})

// Check what admin_update_book does by looking at the RPC
const { data, error } = await client.database.rpc("admin_update_book", {
  p_book_id: "test-fake-id",
  p_title: "test",
  p_author: "test",
  p_category: "novels",
  p_subcategory: "",
  p_subcategory_slug: "",
  p_description: "",
  p_synopsis: null,
  p_cover_primary: null,
  p_cover_hover: null,
  p_featured: false,
  p_is_new: false,
  p_trending: false,
  p_is_demo: false,
  p_formats: [],
})

console.log("RPC result:", JSON.stringify({ data, error }))
