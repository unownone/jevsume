import { describe, expect, it } from "vitest";
import {
  AGENTS_PATH,
  GITHUB_PROFILE_URL,
  GITHUB_REPO_URL,
  MCP_PATH,
  SPONSOR_URL,
} from "../src/lib/site-links.ts";

describe("site footer links", () => {
  it("points at the project repo, profile, agents page, MCP endpoint, and GitHub Sponsors", () => {
    expect(GITHUB_REPO_URL).toBe("https://github.com/unownone/jevsume");
    expect(GITHUB_PROFILE_URL).toBe("https://github.com/unownone");
    expect(SPONSOR_URL).toBe("https://github.com/sponsors/unownone");
    expect(MCP_PATH).toBe("/mcp");
    expect(AGENTS_PATH).toBe("/agents");
  });
});
