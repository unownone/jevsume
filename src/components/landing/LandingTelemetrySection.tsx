import { useCallback, useState } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import {
  AnimatedScoreBar,
  LandingSegmentedControl,
} from "@/components/prosume-motion-ui.tsx";
import { useAnimatedNumber } from "@/components/landing/useAnimatedNumber.ts";
import { useInViewOnce } from "@/components/landing/useInViewOnce.ts";
import { landingCopy } from "@/lib/site-copy.ts";
import { SAMPLE_RESUME_PAPER_SURFACE, sampleResumePreviewLines } from "@/lib/sample-resume-preview.ts";
import { cn } from "@/lib/utils.ts";

const telemetryResumePreview = sampleResumePreviewLines();

const SAMPLE_SCORE = 82;

type TelemetryPresetId = (typeof landingCopy.telemetryPresets)[number]["id"];

function ScoreRing({ value, active }: { value: number; active: boolean }) {
  const animated = useAnimatedNumber(value, active, 1000);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div className="relative mx-auto size-36" aria-hidden>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-reduce:transition-none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums">{animated}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function DimensionBar({
  label,
  value,
  hint,
  warn,
  active,
  selected,
  onSelect,
}: {
  label: string;
  value: number;
  hint: string;
  warn?: boolean;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const animated = useAnimatedNumber(value, active, 800);
  const ratio = animated / 100;

  return (
    <Card
      className={cn(
        LANDING_CARD_INTERACTION,
        "overflow-hidden cursor-pointer",
        selected ? "border-primary/45 ring-1 ring-primary/25" : undefined,
      )}
      data-landing-dimension-state={selected ? "selected" : "idle"}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">{label}</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
            {warn ? <AlertTriangle className="size-3.5 text-warning" aria-label="Needs attention" /> : null}
            {animated}%
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
          <AnimatedScoreBar className="h-full w-full bg-primary" ratio={ratio} />
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function LandingTelemetrySection() {
  const { ref, visible } = useInViewOnce<HTMLElement>();
  const [copied, setCopied] = useState(false);
  const [presetId, setPresetId] = useState<TelemetryPresetId>("balanced");
  const [selectedDimension, setSelectedDimension] = useState(0);

  const preset =
    landingCopy.telemetryPresets.find((item) => item.id === presetId) ?? landingCopy.telemetryPresets[0];
  const presetOptions = landingCopy.telemetryPresets.map((item) => ({ id: item.id, label: item.label }));

  const copySuggestion = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(landingCopy.telemetryFixSuggested);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <LandingReveal as="section" className="space-y-6" data-landing-section="telemetry">
      <LandingSectionHeader
        index={landingCopy.telemetryIndex}
        slug={landingCopy.telemetrySlug}
        title={landingCopy.telemetryTitle}
        status={landingCopy.telemetryStatus}
      />
      <div ref={ref as never} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <Card className={LANDING_CARD_INTERACTION}>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">{landingCopy.telemetryScoreLabel}</CardTitle>
                  <p className="text-xs text-muted-foreground">{landingCopy.telemetryScoreHint}</p>
                </div>
                <LandingSegmentedControl
                  aria-label="Telemetry preset"
                  options={presetOptions}
                  value={presetId}
                  onChange={(next) => {
                    setPresetId(next);
                    setSelectedDimension(0);
                  }}
                  layoutGroupId="telemetry-preset"
                />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-6">
              <ScoreRing value={SAMPLE_SCORE} active={visible} />
            </CardContent>
          </Card>
          <div className="grid gap-3">
            {preset.dimensions.map((dim, index) => (
              <DimensionBar
                key={`${presetId}-${dim.label}`}
                {...dim}
                active={visible}
                selected={selectedDimension === index}
                onSelect={() => setSelectedDimension(index)}
              />
            ))}
          </div>
          <Card className={LANDING_CARD_INTERACTION}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{landingCopy.telemetryFixTitle}</CardTitle>
              <p className="font-mono text-[0.65rem] uppercase tracking-wide text-primary">{landingCopy.telemetryFixImpact}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{landingCopy.telemetryFixOriginalLabel}</p>
                <p className="mt-1 text-muted-foreground">{landingCopy.telemetryFixOriginal}</p>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-[0.65rem] uppercase tracking-wide text-primary">{landingCopy.telemetryFixSuggestedLabel}</p>
                <p className="mt-1">{landingCopy.telemetryFixSuggested}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => void copySuggestion()}>
                <Copy data-icon="inline-start" />
                {copied ? "Copied" : landingCopy.telemetryFixCopy}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className={cn(LANDING_CARD_INTERACTION, "min-h-[22rem]")} aria-label="Sample resume preview">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 pb-3">
            <CardTitle className="font-mono text-xs font-normal text-muted-foreground">{landingCopy.telemetryPreviewFile}</CardTitle>
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-primary">
              {landingCopy.telemetryPreviewBadge}
            </span>
          </CardHeader>
          <CardContent className="p-5">
            <div className={SAMPLE_RESUME_PAPER_SURFACE} data-landing-resume-paper>
              <p className="text-[color:var(--paper-ink)]">{telemetryResumePreview.name} · {telemetryResumePreview.title}</p>
              <div className="mt-3 space-y-2">
                <p className="text-[color:var(--paper-ink)]">EXPERIENCE</p>
                <p><span className="rounded-sm bg-primary/20 px-1 text-[color:var(--paper-ink)] motion-safe:animate-pulse motion-reduce:animate-none">{telemetryResumePreview.highlight}</span></p>
                <p className="rounded-sm border border-dashed border-primary/40 bg-primary/5 px-2 py-1 text-[0.65rem] text-primary">{telemetryResumePreview.footer}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </LandingReveal>
  );
}
