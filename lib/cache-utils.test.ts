import { describe, it, expect, vi } from "vitest"
import { withUncachedFallback, nullOnFailure } from "./cache-utils"

describe("withUncachedFallback", () => {
  it("returns cached value and does not call direct on cache success", async () => {
    const direct = vi.fn().mockResolvedValue("direct")
    const result = await withUncachedFallback(() => Promise.resolve("cached"), direct)
    expect(result).toBe("cached")
    expect(direct).not.toHaveBeenCalled()
  })

  it("falls back to direct when cached rejects", async () => {
    const direct = vi.fn().mockResolvedValue("direct")
    const result = await withUncachedFallback(
      () => Promise.reject(new Error("cache failure")),
      direct,
    )
    expect(result).toBe("direct")
    expect(direct).toHaveBeenCalledTimes(1)
  })

  it("propagates the direct rejection when both fail", async () => {
    await expect(
      withUncachedFallback(
        () => Promise.reject(new Error("cache failure")),
        () => Promise.reject(new Error("db down")),
      ),
    ).rejects.toThrow("db down")
  })
})

describe("nullOnFailure", () => {
  it("returns the resolved value when run succeeds", async () => {
    expect(await nullOnFailure(() => Promise.resolve("book"))).toBe("book")
  })

  it("returns null instead of throwing when run fails", async () => {
    expect(await nullOnFailure(() => Promise.reject(new Error("db down")))).toBe(null)
  })
})
