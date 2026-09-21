import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitHubStarCount, formatStarCount } from "../src/lib/github-stars.ts";

describe("github star count", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("formats counts for display", () => {
    expect(formatStarCount(42)).toBe("42");
    expect(formatStarCount(1400)).toBe("1.4k");
  });

  it("returns null on network failure so UI can fall back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(fetchGitHubStarCount()).resolves.toBeNull();
  });

  it("parses stargazers_count from GitHub API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ stargazers_count: 128 }), { status: 200 }),
      ),
    );
    await expect(fetchGitHubStarCount()).resolves.toBe(128);
  });
});
