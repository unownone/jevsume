import { describe, expect, it } from "vitest";
import { matchPath, resolveSiteRoute } from "../src/lib/routes.ts";

describe("site routes", () => {
  it("maps public paths to page ids", () => {
    expect(resolveSiteRoute("/")).toBe("landing");
    expect(resolveSiteRoute("/review")).toBe("review");
    expect(resolveSiteRoute("/agents")).toBe("agents");
    expect(resolveSiteRoute("/classic")).toBe("classic");
  });

  it("falls back to landing for unknown paths", () => {
    expect(resolveSiteRoute("/nope")).toBe("landing");
    expect(resolveSiteRoute("/mcp")).toBe("landing");
  });

  it("matches review and agents for navigation helpers", () => {
    expect(matchPath("/review", "/review")).toBe(true);
    expect(matchPath("/agents", "/agents")).toBe(true);
    expect(matchPath("/", "/review")).toBe(false);
  });
});
