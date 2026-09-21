import { SiteShell } from "@/components/prosume/SiteShell.tsx";
import { LandingClosingSection } from "@/components/landing/LandingClosingSection.tsx";
import { LandingHeroSection } from "@/components/landing/LandingHeroSection.tsx";
import { LandingIntegrationSection } from "@/components/landing/LandingIntegrationSection.tsx";
import { LandingPipelineSection } from "@/components/landing/LandingPipelineSection.tsx";
import { LandingProofSection } from "@/components/landing/LandingProofSection.tsx";
import { LandingTelemetrySection } from "@/components/landing/LandingTelemetrySection.tsx";
import { LandingTruthSection } from "@/components/landing/LandingTruthSection.tsx";
import { LandingTrustBar } from "@/components/landing/LandingTrustBar.tsx";

export default function LandingPage() {
  return (
    <SiteShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 md:px-6 md:py-14">
        <LandingHeroSection />
        <LandingTelemetrySection />
        <LandingPipelineSection />
        <LandingIntegrationSection />
        <LandingTruthSection />
        <LandingProofSection />
        <LandingTrustBar />
        <LandingClosingSection />
      </main>
    </SiteShell>
  );
}
