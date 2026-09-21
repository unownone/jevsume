import { useLocation } from "react-router-dom";
import { BrandLockup } from "@/components/prosume/BrandMark.tsx";
import { resolveSiteRoute, type SiteRouteId } from "@/lib/routes.ts";
import { cn } from "@/lib/utils.ts";

const LOADING_STATUS: Record<SiteRouteId, string> = {
  landing: "Loading overview",
  review: "Loading review studio",
  agents: "Loading MCP setup",
  classic: "Loading classic review",
};

const PAPER_LINE = "h-1.5 rounded-full bg-[color:var(--paper-ink)]/10";

export function SiteRouteLoadingShell() {
  const { pathname } = useLocation();
  const route = resolveSiteRoute(pathname);
  const status = LOADING_STATUS[route];

  return (
    <div
      className="flex min-h-dvh flex-col bg-background text-foreground"
      data-testid="site-route-loading"
      aria-busy="true"
    >
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 md:px-6">
          <BrandLockup />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[18rem] space-y-5">
          <div
            className={cn(
              "rounded-md border border-border/50 bg-[color:var(--paper)] p-5 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.9)]",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 motion-reduce:animate-none",
            )}
            aria-hidden
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-10 rounded-full bg-primary/35 motion-safe:animate-pulse motion-reduce:animate-none" />
              <span className={cn(PAPER_LINE, "w-14 motion-safe:animate-pulse motion-reduce:animate-none")} />
            </div>
            <div className="space-y-2.5">
              <span className={cn(PAPER_LINE, "block w-full max-w-[11rem]")} />
              <span className={cn(PAPER_LINE, "block w-full")} />
              <span className={cn(PAPER_LINE, "block w-4/5")} />
              <span className={cn(PAPER_LINE, "block w-full max-w-[9rem]")} />
            </div>
          </div>

          <div className="space-y-2.5 text-center">
            <p role="status" aria-live="polite" className="text-sm font-medium tracking-tight text-foreground">
              {status}
            </p>
            <div
              className="route-loading-track mx-auto h-1 w-28 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div className="route-loading-bar h-full rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Preparing the Pro-sume studio shell</p>
          </div>
        </div>
      </main>
    </div>
  );
}
