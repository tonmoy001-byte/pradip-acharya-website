import { createClient } from "@insforge/sdk"

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

const client = createClient({
  baseUrl: requiredEnv("NEXT_PUBLIC_INSFORGE_URL"),
  anonKey: requiredEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY"),
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
