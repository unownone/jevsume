import { Link } from "react-router-dom";
import { ArrowRight, Globe, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import { landingCopy } from "@/lib/site-copy.ts";
import { trackClick } from "@/lib/events.ts";
import { sitePath } from "@/lib/routes.ts";

export function LandingIntegrationSection() {
  return (
    <LandingReveal as="section" className="space-y-6" data-landing-section="integration">
      <LandingSectionHeader
        index={landingCopy.integrationIndex}
        slug={landingCopy.integrationSlug}
        title={landingCopy.integrationTitle}
        description={landingCopy.integrationBody}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={LANDING_CARD_INTERACTION}>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
              <Globe />
            </div>
            <CardTitle>{landingCopy.integrationWebTitle}</CardTitle>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {landingCopy.integrationWebPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardHeader>
          <CardContent>
            <Button variant="link" className="h-auto px-0" asChild>
              <Link to={sitePath("review")} onClick={() => trackClick("/cta-integration-web")}>
                {landingCopy.integrationWebCta}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className={LANDING_CARD_INTERACTION}>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
              <Zap />
            </div>
            <CardTitle>{landingCopy.integrationMcpTitle}</CardTitle>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {landingCopy.integrationMcpPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardHeader>
          <CardContent>
            <Button variant="link" className="h-auto px-0" asChild>
              <Link to={sitePath("agents")} onClick={() => trackClick("/cta-integration-mcp")}>
                {landingCopy.integrationMcpCta}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </LandingReveal>
  );
}
