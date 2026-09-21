import { Link } from "react-router-dom";
import { ArrowRight, Bolt, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { LandingReveal } from "@/components/landing/LandingReveal.tsx";
import { LANDING_CARD_INTERACTION } from "@/components/landing/landing-motion.ts";
import { landingCopy } from "@/lib/site-copy.ts";
import { trackClick } from "@/lib/events.ts";
import { sitePath } from "@/lib/routes.ts";
import { cn } from "@/lib/utils.ts";

export function LandingHeroSection() {
  return (
    <LandingReveal as="section" className="relative flex flex-col items-center text-center" data-landing-section="hero">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(232,197,114,0.16),transparent_62%)]"
        aria-hidden
      />
      <Badge variant="secondary" className="relative mb-4 gap-2 px-3 py-1">
        <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse motion-reduce:animate-none" aria-hidden />
        {landingCopy.eyebrow}
      </Badge>
      <h1 className="relative max-w-4xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-5xl">
        {landingCopy.heroTitle}
      </h1>
      <p className="relative mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{landingCopy.heroBody}</p>
      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" asChild className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100">
          <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-hero")}>
            {landingCopy.primaryCta}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild className="motion-safe:transition-[border-color,background-color] motion-safe:hover:border-primary/50">
          <Link to={sitePath("agents")} onClick={() => trackClick("/cta-mcp-hero")}>
            {landingCopy.secondaryCta}
            <Bolt data-icon="inline-end" className="text-primary" />
          </Link>
        </Button>
      </div>

      <Card
        className={cn(
          "relative mt-10 w-full max-w-3xl text-left",
          LANDING_CARD_INTERACTION,
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-reduce:animate-none",
        )}
        data-landing-section="hero-preview"
      >
        <CardContent className="space-y-4 p-5 md:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">{landingCopy.heroPreviewEyebrow}</p>
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" aria-hidden>
              {landingCopy.heroPreviewLens}
            </div>
          </div>
          <Link
            to={sitePath("review")}
            onClick={() => trackClick("/cta-review-hero-dropzone")}
            className={cn(
              "group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10",
              "motion-safe:transition-[border-color,background-color] motion-safe:duration-200",
              "hover:border-primary/45 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <FileUp className="size-8 text-primary motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0" />
            <p className="text-sm text-muted-foreground">
              {landingCopy.heroPreviewDropTitle}{" "}
              <span className="text-foreground underline-offset-4 group-hover:underline">{landingCopy.heroPreviewDropHint}</span>
            </p>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            <Link to={`${sitePath("review")}?scene=empty`} className="text-primary underline-offset-4 hover:underline" onClick={() => trackClick("/cta-review-sample")}>
              {landingCopy.heroPreviewSample}
            </Link>
          </p>
        </CardContent>
      </Card>
    </LandingReveal>
  );
}
