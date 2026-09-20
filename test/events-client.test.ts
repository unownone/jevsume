import { afterEach, describe, expect, it, vi } from "vitest";
import { trackClick, trackPageview, trackWebsiteEvent } from "../src/lib/events.ts";

describe("website event client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts pageviews and clicks to /api/events", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    trackWebsiteEvent("pageview", "/");
    trackClick("/review");
    trackPageview("/?view=classic");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "pageview", page: "/" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "click", page: "/review" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/events",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "pageview", page: "/?view=classic" }),
      }),
    );
  });

  it("swallows network errors so tracking never breaks the UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(() => trackClick("/demo")).not.toThrow();
  });
});
