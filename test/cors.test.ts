import { describe, expect, it } from "vitest";
import { MockJudgmentProvider } from "../packages/jev/index.ts";
import { allowCorsOrigin } from "../worker/cors.ts";
import { createApp } from "../worker/app.ts";
import { ReviewEngine } from "../worker/engine.ts";
import { createMemoryStores } from "../worker/storage/memory.ts";

function testApp() {
  const stores = createMemoryStores();
  const engine = new ReviewEngine(new MockJudgmentProvider(), stores);
  return createApp({ engine, visitors: stores.visitors });
}

describe("allowCorsOrigin", () => {
  it("allows the Worker origin and rejects every other origin", () => {
    expect(allowCorsOrigin("https://jevsume.example", "https://jevsume.example/api/health")).toBe(
      "https://jevsume.example",
    );
    expect(allowCorsOrigin("http://localhost:5173", "http://localhost:5173/api/health")).toBe(
      "http://localhost:5173",
    );
    expect(allowCorsOrigin("https://evil.example", "https://jevsume.example/api/health")).toBeUndefined();
    expect(allowCorsOrigin("https://jevsume.example", "http://jevsume.example/api/health")).toBeUndefined();
    expect(allowCorsOrigin(undefined, "https://jevsume.example/api/health")).toBeUndefined();
  });
});

describe("API CORS", () => {
  it("does not reflect a foreign Origin and does not use *", async () => {
    const res = await testApp().request("https://jevsume.example/api/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("https://evil.example");
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it("allows same-origin browser calls", async () => {
    const res = await testApp().request("https://jevsume.example/api/health", {
      headers: { Origin: "https://jevsume.example" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://jevsume.example");
  });
});
