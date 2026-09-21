import { DEFAULT_PERSONA, DEFAULT_PERSONA_ID } from "../packages/jev/default-persona.ts";
import {
  choosePresetForUser,
  JOB_TRACKS,
  parsePresetPersonaId,
  presetById,
  presetPersonaId,
  RESUME_PRESETS,
  type JobTrack,
  type ResumePreset,
} from "../shared/resume-presets.ts";
import type { CompactLens, CompactLensDetail } from "./compact.ts";

export const GENERAL_LENS_ID = DEFAULT_PERSONA_ID;

function isJobTrack(value: string): value is JobTrack {
  return (JOB_TRACKS as readonly string[]).includes(value);
}

function lensFromPreset(preset: ResumePreset): CompactLens {
  return {
    id: presetPersonaId(preset.id),
    title: preset.title,
    track: preset.track,
    level: preset.level,
    tags: [...preset.tags],
    blurb: preset.blurb,
  };
}

function generalLens(): CompactLens {
  return {
    id: GENERAL_LENS_ID,
    title: DEFAULT_PERSONA.title,
    track: "general",
    level: "any",
    tags: [...DEFAULT_PERSONA.tags],
    blurb: DEFAULT_PERSONA.summary,
  };
}

export function normalizeLensId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed || trimmed === GENERAL_LENS_ID) {
    return GENERAL_LENS_ID;
  }
  const presetId = parsePresetPersonaId(trimmed) ?? (presetById(trimmed) ? trimmed : null);
  if (presetId) {
    return presetPersonaId(presetId);
  }
  return trimmed;
}

export function listJobLenses(input?: { track?: string; query?: string }): CompactLens[] {
  const trackFilter = input?.track?.trim().toLowerCase();
  const query = input?.query?.trim().toLowerCase();
  const items = [generalLens(), ...RESUME_PRESETS.map(lensFromPreset)];
  return items.filter((item) => {
    if (trackFilter) {
      if (trackFilter === "general") {
        if (item.id !== GENERAL_LENS_ID) {
          return false;
        }
      } else if (!isJobTrack(trackFilter) || item.track !== trackFilter) {
        return false;
      }
    }
    if (!query) {
      return true;
    }
    const haystack = `${item.id} ${item.title} ${item.tags.join(" ")} ${item.blurb}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function getJobLens(id: string): CompactLensDetail | null {
  const normalized = normalizeLensId(id);
  if (normalized === GENERAL_LENS_ID) {
    const base = generalLens();
    return {
      ...base,
      company: "",
      jobText: DEFAULT_PERSONA.jobDescription,
    };
  }
  const presetId = parsePresetPersonaId(normalized);
  const preset = presetId ? presetById(presetId) : undefined;
  if (!preset) {
    return null;
  }
  return {
    ...lensFromPreset(preset),
    company: preset.company,
    jobText: preset.jobText,
  };
}

export function suggestJobLens(resumeText: string): CompactLens {
  return lensFromPreset(choosePresetForUser({ resumeText, random: () => 0 }));
}
