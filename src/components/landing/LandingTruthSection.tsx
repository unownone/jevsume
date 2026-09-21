import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import { landingCopy, TYPESAFE_SYSTEM_ONE, TYPESAFE_URL } from "@/lib/site-copy.ts";
import { cn } from "@/lib/utils.ts";

export function LandingTruthSection() {
  return (
    <LandingReveal as="section" className="grid gap-6 md:grid-cols-2" data-landing-section="truth">
      <Card className={LANDING_CARD_INTERACTION}>
        <CardHeader>
          <CardTitle>{landingCopy.typesafeTitle}</CardTitle>
          <CardDescription>{landingCopy.typesafeBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="link" className="px-0" asChild>
            <a href={TYPESAFE_URL} target="_blank" rel="noreferrer">
              {TYPESAFE_SYSTEM_ONE}
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card className={LANDING_CARD_INTERACTION}>
        <CardHeader>
          <CardTitle>{landingCopy.proofTitle}</CardTitle>
          <CardDescription>{landingCopy.proofBody}</CardDescription>
        </CardHeader>
      </Card>
      <Card className={cn(LANDING_CARD_INTERACTION, "md:col-span-2")}>
        <CardHeader>
          <CardTitle>{landingCopy.accuracyTitle}</CardTitle>
          <CardDescription>{landingCopy.accuracyBody}</CardDescription>
        </CardHeader>
      </Card>
    </LandingReveal>
  );
}
