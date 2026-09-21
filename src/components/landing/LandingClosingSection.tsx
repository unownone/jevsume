import { Link } from "react-router-dom";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { Button } from "@/components/ui/button.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import { landingCopy } from "@/lib/site-copy.ts";
import { trackClick } from "@/lib/events.ts";
import { sitePath } from "@/lib/routes.ts";
import { GITHUB_REPO_URL } from "@/lib/site-links.ts";
import { cn } from "@/lib/utils.ts";

export function LandingClosingSection() {
  return (
    <LandingReveal as="section" className={cn("rounded-xl border p-8 text-center", LANDING_CARD_INTERACTION)} data-landing-section="closing">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{landingCopy.closingTitle}</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100">
          <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-footer")}>
            {landingCopy.closingPrimary}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={sitePath("agents")} onClick={() => trackClick("/cta-mcp-footer")}>
            {landingCopy.closingSecondary}
          </Link>
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Source on{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        . Pro-sume™ {new Date().getFullYear()} · Made by UnownOne
      </p>
    </LandingReveal>
  );
}
