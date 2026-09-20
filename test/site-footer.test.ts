import { describe, expect, it } from "vitest";
import {
  GITHUB_PROFILE_URL,
  GITHUB_REPO_URL,
  SPONSOR_URL,
} from "../src/lib/site-links.ts";

describe("site footer links", () => {
  it("points at the project repo, profile, and GitHub Sponsors", () => {
    expect(GITHUB_REPO_URL).toBe("https://github.com/unownone/jevsume");
    expect(GITHUB_PROFILE_URL).toBe("https://github.com/unownone");
    expect(SPONSOR_URL).toBe("https://github.com/sponsors/unownone");
  });
});
