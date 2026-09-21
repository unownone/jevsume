import { SiteHeader } from "@/components/prosume/SiteHeader.tsx";
import StudioApp from "@/studio/StudioApp.tsx";

export default function ReviewStudioPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <div className="min-h-0 flex-1">
        <StudioApp />
      </div>
    </div>
  );
}
