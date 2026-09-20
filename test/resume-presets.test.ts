import { describe, expect, it } from "vitest";
import { extractRequirementCandidates } from "../worker/ats/group.ts";
import {
  CHOOSE_FOR_ME_ID,
  DEFAULT_PRESET_ID,
  JOB_TRACKS,
  choosePersonaIdForUser,
  choosePresetForUser,
  groupedResumePresets,
  isChooseForMe,
  jobFieldsFromPreset,
  parsePresetPersonaId,
  presetById,
  presetPersonaId,
  RESUME_PRESETS,
  resolvePresetSelection,
} from "../shared/resume-presets.ts";

describe("resume presets", () => {
  it("ships one default listing and resume per track, including named levels", () => {
    expect(RESUME_PRESETS.length).toBeGreaterThanOrEqual(20);
    const ids = RESUME_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(presetById(DEFAULT_PRESET_ID)?.title).toBe("Staff Backend Engineer");

    const tracks = new Set(RESUME_PRESETS.map((preset) => preset.track));
    for (const track of JOB_TRACKS) {
      expect(tracks.has(track)).toBe(true);
    }

    const titles = RESUME_PRESETS.map((preset) => preset.title.toLowerCase());
    expect(titles.some((title) => title.includes("software engineer"))).toBe(true);
    expect(titles.some((title) => title.includes("product manager"))).toBe(true);
    expect(titles.some((title) => title.includes("lead"))).toBe(true);
    expect(titles.some((title) => title.includes("manager"))).toBe(true);
    expect(titles.some((title) => title.includes("sales") || title.includes("account"))).toBe(true);
    expect(titles.some((title) => title.includes("marketing"))).toBe(true);
    expect(titles.some((title) => title.includes("outreach") || title.includes("sdr"))).toBe(true);
    expect(titles.some((title) => title.includes("devops"))).toBe(true);
    expect(titles.some((title) => title.includes("reliability") || title.includes("sre"))).toBe(true);
  });

  it("gives every preset a screenable job listing and a short sample resume", () => {
    for (const preset of RESUME_PRESETS) {
      const job = jobFieldsFromPreset(preset);
      expect(job.jobTitle).toBe(preset.title);
      expect(job.company).toBe("Acme");
      expect(extractRequirementCandidates(preset.jobText).length).toBeGreaterThanOrEqual(3);
      expect(preset.resumeText).toContain(preset.resumeName);
      expect(preset.resumeText).toMatch(/Summary/i);
      expect(preset.resumeText).toMatch(/Experience/i);
      expect(preset.resumeText).toMatch(/Skills/i);
      expect(preset.blurb.length).toBeGreaterThan(20);
    }
  });

  it("groups presets by track without dropping any item", () => {
    const grouped = groupedResumePresets();
    expect(grouped.map((group) => group.track)).toEqual([...JOB_TRACKS]);
    expect(grouped.reduce((sum, group) => sum + group.items.length, 0)).toBe(RESUME_PRESETS.length);
  });

  it("uses a stable persona id prefix for built-in presets", () => {
    expect(presetPersonaId("swe-staff")).toBe("preset:swe-staff");
    expect(presetPersonaId("preset:swe-staff")).toBe("preset:swe-staff");
    expect(parsePresetPersonaId("preset:swe-staff")).toBe("swe-staff");
    expect(parsePresetPersonaId("default")).toBeNull();
    expect(parsePresetPersonaId("preset:missing")).toBeNull();
  });
});

describe("choose for me", () => {
  it("uses a sentinel that is not a catalog id or a user-added persona id", () => {
    expect(isChooseForMe(CHOOSE_FOR_ME_ID)).toBe(true);
    expect(isChooseForMe("swe-staff")).toBe(false);
    expect(isChooseForMe("preset:swe-staff")).toBe(false);
    expect(presetById(CHOOSE_FOR_ME_ID)).toBeUndefined();
    expect(parsePresetPersonaId(CHOOSE_FOR_ME_ID)).toBeNull();
  });

  it("picks only built-in default roles, never a user-added job id", () => {
    const catalogIds = new Set(RESUME_PRESETS.map((preset) => preset.id));
    const first = choosePresetForUser({ random: () => 0 });
    const last = choosePresetForUser({ random: () => 0.999 });
    expect(catalogIds.has(first.id)).toBe(true);
    expect(catalogIds.has(last.id)).toBe(true);
    expect(first.id).toBe(RESUME_PRESETS[0]?.id);
    expect(last.id).toBe(RESUME_PRESETS.at(-1)?.id);
    expect(first.id).not.toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("matches a product resume to a default product role instead of a random engineering listing", () => {
    const resume = presetById("pm-senior")?.resumeText ?? "";
    const chosen = choosePresetForUser({ resumeText: resume, random: () => 0 });
    expect(chosen.track).toBe("product");
    expect(chosen.id).toMatch(/^pm-/);
  });

  it("matches an SRE resume to the default SRE listing", () => {
    const resume = presetById("sre-senior")?.resumeText ?? "";
    const chosen = choosePresetForUser({ resumeText: resume, random: () => 0 });
    expect(chosen.id).toBe("sre-senior");
  });

  it("resolves the choose-for-me sentinel to a real preset id", () => {
    expect(resolvePresetSelection("", { random: () => 0 })).toBe("");
    expect(resolvePresetSelection("frontend-senior")).toBe("frontend-senior");
    expect(resolvePresetSelection(CHOOSE_FOR_ME_ID, { random: () => 0 })).toBe(RESUME_PRESETS[0]?.id);
  });

  it("maps the pick onto a built-in preset persona, never a user-added job", () => {
    const id = choosePersonaIdForUser({ random: () => 0 });
    expect(id).toBe(`preset:${RESUME_PRESETS[0]?.id}`);
    expect(parsePresetPersonaId(id)).toBe(RESUME_PRESETS[0]?.id);
  });
});
