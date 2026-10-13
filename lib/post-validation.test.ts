import { describe, it, expect } from "vitest"
import { validatePostBody } from "@/lib/post-validation"

describe("validatePostBody", () => {
  it("accepts a valid payload", () => {
    expect(
      validatePostBody({ title: "T", slug: "my-post", tags: ["a", "b"] }),
    ).toBeNull()
  })

  it("rejects an empty title", () => {
    expect(validatePostBody({ title: "", slug: "ok" })).toMatch(/Title/)
  })

  it("rejects a title over 200 characters", () => {
    expect(validatePostBody({ title: "x".repeat(201), slug: "ok" })).toMatch(/Title/)
  })

  it("rejects an uppercase slug", () => {
    expect(validatePostBody({ title: "T", slug: "Bad-Slug" })).toMatch(/Slug/)
  })

  it("rejects a slug with underscores", () => {
    expect(validatePostBody({ title: "T", slug: "bad_slug" })).toMatch(/Slug/)
  })

  it("rejects a slug over 120 characters", () => {
    expect(validatePostBody({ title: "T", slug: "x".repeat(121) })).toMatch(/Slug/)
  })

  it("rejects more than 20 tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `t${i}`)
    expect(validatePostBody({ title: "T", slug: "ok", tags })).toMatch(/tags/)
  })

  it("rejects a tag over 40 characters", () => {
    expect(validatePostBody({ title: "T", slug: "ok", tags: ["x".repeat(41)] })).toMatch(/tag/)
  })

  it("rejects a non-array tags field", () => {
    expect(validatePostBody({ title: "T", slug: "ok", tags: "nope" })).toMatch(/Tags/)
  })
})