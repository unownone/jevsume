import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import { landingCopy } from "@/lib/site-copy.ts";

export function LandingProofSection() {
  return (
    <LandingReveal as="section" className="space-y-6" data-landing-section="proof">
      <div className="space-y-3 text-center md:text-left">
        <Badge variant="secondary" className="font-mono text-[0.65rem] uppercase tracking-wider">
          {landingCopy.proofEyebrow}
        </Badge>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold md:text-3xl">{landingCopy.proofHeadline}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {landingCopy.proofCards.map((card) => (
          <Card key={card.title} className={LANDING_CARD_INTERACTION}>
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{card.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </LandingReveal>
  );
}
