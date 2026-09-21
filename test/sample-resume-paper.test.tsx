/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DEFAULT_PRESET } from "../shared/resume-presets.ts";
import { SAMPLE_RESUME_PAPER_SURFACE, sampleResumePreviewLines } from "../src/lib/sample-resume-preview.ts";
import { renderPage } from "../src/studio/pdf.ts";
import { LandingTelemetrySection } from "../src/components/landing/LandingTelemetrySection.tsx";

afterEach(() => cleanup());

describe("sample resume paper presentation", () => {
  it("derives landing preview copy from the default demo preset", () => {
    const preview = sampleResumePreviewLines();
    expect(preview.name).toBe(DEFAULT_PRESET.resumeName);
    expect(DEFAULT_PRESET.resumeText).toContain(preview.highlight);
  });

  it("styles the studio PDF canvas to blend with ivory paper", () => {
    const css = readFileSync(path.join(process.cwd(), "src/studio/studio.css"), "utf8");
    expect(css).toMatch(/\.paper canvas[\s\S]*mix-blend-mode:\s*multiply/);
  });

  it("renders PDF pages with paper-matched canvas background", async () => {
    const canvas = document.createElement("canvas");
    const paper = document.createElement("article");
    paper.className = "paper";
    paper.style.backgroundColor = "#f7f4ec";
    paper.appendChild(canvas);
    document.body.appendChild(paper);
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    await renderPage({ getViewport: () => ({ width: 612, height: 792 }), render } as never, canvas, 400);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ background: "rgb(247, 244, 236)" }));
  });

  it("shows ivory paper sample resume on the landing telemetry section", () => {
    render(<MemoryRouter><LandingTelemetrySection /></MemoryRouter>);
    expect(document.querySelector("[data-landing-resume-paper]")).toBeTruthy();
    expect(screen.getByText(new RegExp(DEFAULT_PRESET.resumeName))).toBeInTheDocument();
    expect(SAMPLE_RESUME_PAPER_SURFACE).toContain("var(--paper)");
  });
});
