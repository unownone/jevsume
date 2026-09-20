import { describe, expect, it } from "vitest";
import { parseWebsiteEventType, requestCountry, writeWebsiteEvent } from "../worker/analytics.ts";
import { createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { MockJudgmentProvider } from "../packages/jev/index.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";
import { createMemoryAnalytics } from "./memory-analytics.ts";

function testApp() {
  const stores = createMemoryStores();
  const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
  return createApp({ engine, visitors: stores.visitors });
}

function analyticsEnv(dataset: AnalyticsEngineDataset): CloudflareBindings {
  return {
    ANALYTICS: dataset,
    VISITORS: undefined as unknown as KVNamespace,
    DB: undefined as unknown as D1Database,
    TYPESAFE_MODEL: "jev-latest",
    TYPESAFE_BASE_URL: "https://api.typesafe.ai",
  };
}

describe("website events", () => {
  it("writes pageview blobs in event_type, page, country order", () => {
    const analytics = createMemoryAnalytics();
    writeWebsiteEvent(analytics.dataset, {
      type: "pageview",
      page: "/api/health",
      country: "US",
      id: "event-1",
    });
    expect(analytics.points).toEqual([
      {
        blobs: ["pageview", "/api/health", "US"],
        doubles: [1],
        indexes: ["event-1"],
      },
    ]);
  });

  it("writes click events the same way", () => {
    const analytics = createMemoryAnalytics();
    writeWebsiteEvent(analytics.dataset, {
      type: "click",
      page: "/review",
      country: "IN",
      id: "event-2",
    });
    expect(analytics.points[0]?.blobs).toEqual(["click", "/review", "IN"]);
    expect(analytics.points[0]?.doubles).toEqual([1]);
  });

  it("does nothing when the Analytics Engine binding is missing", () => {
    expect(() =>
      writeWebsiteEvent(undefined, {
        type: "pageview",
        page: "/",
        country: "XX",
      }),
    ).not.toThrow();
  });

  it("falls back to XX when cf-ipcountry is absent", () => {
    expect(requestCountry(new Request("https://example.test/"))).toBe("XX");
    expect(
      requestCountry(
        new Request("https://example.test/", { headers: { "cf-ipcountry": "FR" } }),
      ),
    ).toBe("FR");
  });

  it("rejects unknown event types", () => {
    expect(parseWebsiteEventType("bounce")).toBeUndefined();
    expect(parseWebsiteEventType("pageview")).toBe("pageview");
    expect(parseWebsiteEventType("click")).toBe("click");
  });

  it("records a pageview for each API request", async () => {
    const analytics = createMemoryAnalytics();
    const res = await testApp().request(
      "/api/health",
      { headers: { "cf-ipcountry": "DE" } },
      analyticsEnv(analytics.dataset),
    );
    expect(res.status).toBe(200);
    expect(analytics.points).toHaveLength(1);
    expect(analytics.points[0]?.blobs).toEqual(["pageview", "/api/health", "DE"]);
    expect(analytics.points[0]?.doubles).toEqual([1]);
    expect(analytics.points[0]?.indexes?.[0]).toEqual(expect.any(String));
  });

  it("records client pageviews and clicks via POST /api/events", async () => {
    const analytics = createMemoryAnalytics();
    const env = analyticsEnv(analytics.dataset);
    const pageview = await testApp().request(
      "/api/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-ipcountry": "GB" },
        body: JSON.stringify({ type: "pageview", page: "/" }),
      },
      env,
    );
    expect(pageview.status).toBe(200);
    expect(await pageview.json()).toEqual({ ok: true });

    const click = await testApp().request(
      "/api/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-ipcountry": "GB" },
        body: JSON.stringify({ type: "click", page: "/review" }),
      },
      env,
    );
    expect(click.status).toBe(200);

    const types = analytics.points.map((point) => point.blobs?.[0]);
    const pages = analytics.points.map((point) => point.blobs?.[1]);
    expect(types).toContain("pageview");
    expect(types).toContain("click");
    expect(pages).toContain("/");
    expect(pages).toContain("/review");
    expect(analytics.points.every((point) => point.blobs?.[2] === "GB")).toBe(true);
  });

  it("rejects events with an unknown type", async () => {
    const analytics = createMemoryAnalytics();
    const res = await testApp().request(
      "/api/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "scroll", page: "/" }),
      },
      analyticsEnv(analytics.dataset),
    );
    expect(res.status).toBe(400);
    expect(analytics.points.some((point) => point.blobs?.[0] === "scroll")).toBe(false);
  });

  it("still serves APIs when analytics is unbound", async () => {
    const res = await testApp().request("/api/health");
    expect(res.status).toBe(200);
  });
});
