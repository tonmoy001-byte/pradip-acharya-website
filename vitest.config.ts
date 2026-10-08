import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"
import { existsSync, readFileSync } from "node:fs"

/**
 * Load NEXT_PUBLIC_* variables from .env.local so server code that reads them
 * at module scope (e.g. lib/api.ts) behaves the same under test as in dev.
 * No values are hardcoded here and no file is committed.
 */
function loadPublicEnv(): Record<string, string> {
  const envPath = fileURLToPath(new URL("./.env.local", import.meta.url))
  if (!existsSync(envPath)) return {}

  const env: Record<string, string> = {}
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    env[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }
  return env
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    env: loadPublicEnv(),
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".kilo/**"],
  },
})
