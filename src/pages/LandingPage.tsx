import { Link } from "react-router-dom";
import { ArrowRight, Bolt, CheckCircle2, Layers, ScanLine, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/prosume/SiteShell.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { landingCopy, TYPESAFE_SYSTEM_ONE, TYPESAFE_URL } from "@/lib/site-copy.ts";
import { trackClick } from "@/lib/events.ts";
import { sitePath } from "@/lib/routes.ts";
import { GITHUB_REPO_URL } from "@/lib/site-links.ts";

export default function LandingPage() {
  return (
    <SiteShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 md:px-6 md:py-14">
        <section className="relative flex flex-col items-center text-center">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(232,197,114,0.14),transparent_60%)]"
            aria-hidden
          />
          <Badge variant="secondary" className="mb-4">
            {landingCopy.eyebrow}
          </Badge>
          <h1 className="max-w-4xl font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-5xl">
            {landingCopy.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{landingCopy.heroBody}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-hero")}>
                {landingCopy.primaryCta}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to={sitePath("agents")} onClick={() => trackClick("/cta-mcp-hero")}>
                {landingCopy.secondaryCta}
                <Bolt data-icon="inline-end" className="text-primary" />
              </Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="pipeline-heading" className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 id="pipeline-heading" className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              {landingCopy.pipelineTitle}
            </h2>
          </div>
          {landingCopy.pipelineSteps.map((step, index) => (
            <Card key={step.title}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted text-primary">
                  {index === 0 ? (
                    <ScanLine />
                  ) : index === 1 ? (
                    <Layers />
                  ) : index === 2 ? (
                    <Sparkles />
                  ) : (
                    <CheckCircle2 />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription className="mt-1 text-sm">{step.body}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
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
          <Card>
            <CardHeader>
              <CardTitle>{landingCopy.proofTitle}</CardTitle>
              <CardDescription>{landingCopy.proofBody}</CardDescription>
            </CardHeader>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{landingCopy.accuracyTitle}</CardTitle>
              <CardDescription>{landingCopy.accuracyBody}</CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="rounded-xl border border-border bg-card/60 p-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{landingCopy.closingTitle}</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
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
              GitHub (jevsume)
            </a>
            . Pro-sume™ {new Date().getFullYear()} · Made by UnownOne
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
