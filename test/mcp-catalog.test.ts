import { describe, expect, it } from "vitest";
import { DEFAULT_PERSONA_ID } from "../packages/jev/default-persona.ts";
import { DEFAULT_PRESET_ID, presetPersonaId, RESUME_PRESETS } from "../shared/resume-presets.ts";
import { getJobLens, listJobLenses, normalizeLensId, suggestJobLens } from "../mcp/catalog.ts";

describe("job lens catalog", () => {
  it("lists the general lens and every baked-in preset without job listings", () => {
    const items = listJobLenses();
    expect(items[0]?.id).toBe(DEFAULT_PERSONA_ID);
    expect(items.length).toBe(1 + RESUME_PRESETS.length);
    expect(items.some((item) => item.id === presetPersonaId(DEFAULT_PRESET_ID))).toBe(true);
    expect(JSON.stringify(items)).not.toContain("Requirements");
  });

  it("filters by track and query", () => {
    const product = listJobLenses({ track: "product" });
    expect(product.length).toBeGreaterThan(0);
    expect(product.every((item) => item.track === "product")).toBe(true);

    const general = listJobLenses({ track: "general" });
    expect(general).toEqual([expect.objectContaining({ id: DEFAULT_PERSONA_ID })]);

    const kafka = listJobLenses({ query: "kafka" });
    expect(kafka.some((item) => item.id === "preset:swe-staff")).toBe(true);
  });

  it("normalizes bare preset ids and returns job text only on get", () => {
    expect(normalizeLensId("swe-staff")).toBe("preset:swe-staff");
    expect(normalizeLensId("preset:swe-staff")).toBe("preset:swe-staff");
    expect(normalizeLensId("default")).toBe("default");
    const lens = getJobLens("swe-staff");
    expect(lens?.id).toBe("preset:swe-staff");
    expect(lens?.jobText).toMatch(/Kafka/i);
    expect(getJobLens("nope")).toBeNull();
  });

  it("suggests a staff backend lens for a go/kafka resume", () => {
    const suggested = suggestJobLens(
      "Staff engineer. Built a Go + Kafka pipeline handling 2M events/day. Mentors seniors.",
    );
    expect(suggested.id).toBe("preset:swe-staff");
  });
});
