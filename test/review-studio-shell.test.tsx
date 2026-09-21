/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReviewStudio } from "@/studio/ReviewStudio.tsx";
import { EMPTY_JOB_TARGET } from "../shared/job-target.ts";
import type { OverlayFinding, StudioScore } from "@/studio/types.ts";

const score: StudioScore = {
  value: 77,
  verdict: "Wording is the thin spot on this page.",
  noteCount: 2,
  validity: 69,
  evidence: 82,
  leadershipLine: "Leadership reads clearly.",
  jobsLine: "Roles are mapped.",
  skillsLine: "Skills are present.",
  rewriteLine: "Suggestions available.",
  rewrite: "none",
  strong: "Structure",
  weak: "Metrics",
  dimensions: [{ id: "skills", label: "Skills", score: 3.2, max: 4 }],
  suggestions: [],
};

const findings: OverlayFinding[] = [
  {
    id: "f-1",
    severity: "partial",
    title: "Tense and format",
    detail: "Use past tense for prior roles.",
    needle: "tense",
    box: { page: 1, x: 0.1, y: 0.2, w: 0.4, h: 0.04 },
    origin: "jev",
    index: 1,
  },
];

afterEach(() => cleanup());

function renderShell(isNarrow: boolean) {
  const noteRef = { current: null };
  return render(
    <MemoryRouter>
      <ReviewStudio
        scene="reviewed"
        reading={false}
        targeted
        jobOpen={false}
        jobLabel="Engineering Lead · Acme"
        jobTarget={EMPTY_JOB_TARGET}
        resumeText="Sample"
        filename="demo.pdf"
        data={new ArrayBuffer(8)}
        zoom={1}
        score={score}
        selected={[]}
        findings={findings}
        sectionBands={[]}
        activeId={null}
        hoveredId={null}
        drawMode={false}
        hot={false}
        error={null}
        demoPresetId="swe-staff"
        isNarrow={isNarrow}
        diagnosticsOpen={false}
        active={null}
        messages={[]}
        draft=""
        fromRect={null}
        toRect={null}
        noteRef={noteRef}
        onJobOpenToggle={vi.fn()}
        onJobClose={vi.fn()}
        onJobTargetChange={vi.fn()}
        onDiagnosticsOpenChange={vi.fn()}
        onHot={vi.fn()}
        onFiles={vi.fn()}
        onDemoPresetId={vi.fn()}
        onDemo={vi.fn()}
        onGlyphs={vi.fn()}
        onSelect={vi.fn()}
        onHover={vi.fn()}
        onDraw={vi.fn()}
        onToggleSelected={vi.fn()}
        onZoomDelta={vi.fn()}
        onReview={vi.fn()}
        onDrawModeToggle={vi.fn()}
        onDraft={vi.fn()}
        onSend={vi.fn()}
        onIgnore={vi.fn()}
        onStepFinding={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("ReviewStudio presentation shell", () => {
  it("renders wide layout regions together", () => {
    renderShell(false);
    expect(document.querySelector(".studio.is-wide")).toBeInTheDocument();
    expect(document.querySelector(".score-panel")).toBeInTheDocument();
    expect(document.querySelector('[data-studio-panel="diagnostics"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /JevScore 77/i })).toBeInTheDocument();
  });

  it("renders narrow layout without inline score rail", () => {
    renderShell(true);
    expect(document.querySelector(".studio.is-narrow")).toBeInTheDocument();
    expect(document.querySelector(".stage")).not.toHaveClass("has-score");
    expect(document.querySelector(".diagnostics-rail-wrap")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Diagnostics$/i })).toBeInTheDocument();
  });
});
