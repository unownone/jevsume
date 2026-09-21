import { DEFAULT_PRESET, type ResumePreset } from "../../shared/resume-presets.ts";

export const SAMPLE_RESUME_PAPER_SURFACE =
  "rounded-sm border border-border/50 bg-[color:var(--paper)] p-5 font-mono text-[0.7rem] leading-relaxed text-[color:var(--paper-mute)] shadow-[0_20px_50px_-36px_rgba(0,0,0,0.85)]";

export function sampleResumePreviewLines(preset: ResumePreset = DEFAULT_PRESET) {
  const lines = preset.resumeText.split("\n").map((line) => line.trim()).filter(Boolean);
  const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));
  const highlight = experienceIndex >= 0 ? (lines[experienceIndex + 1] ?? "") : "";
  return {
    name: lines[0] ?? preset.resumeName,
    title: lines[1] ?? preset.title,
    highlight,
    footer: "Suggested revision available in studio",
  };
}
