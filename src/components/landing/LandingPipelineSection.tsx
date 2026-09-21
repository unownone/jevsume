import { CheckCircle2, Layers, ScanLine, Sparkles } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import { landingCopy } from "@/lib/site-copy.ts";

const STEP_ICONS = [ScanLine, Layers, Sparkles, CheckCircle2] as const;

export function LandingPipelineSection() {
  return (
    <LandingReveal as="section" className="space-y-6" data-landing-section="pipeline" aria-labelledby="pipeline-heading">
      <h2 id="pipeline-heading" className="font-[family-name:var(--font-display)] text-2xl font-semibold md:text-3xl">
        {landingCopy.pipelineTitle}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {landingCopy.pipelineSteps.map((step, index) => {
          const Icon = STEP_ICONS[index] ?? CheckCircle2;
          return (
            <Card key={step.title} className={LANDING_CARD_INTERACTION}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                  <Icon />
                </div>
                <div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription className="mt-1 text-sm">{step.body}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </LandingReveal>
  );
}
