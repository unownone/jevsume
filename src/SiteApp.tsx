import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { LegacyViewRedirect } from "@/components/prosume/LegacyViewRedirect.tsx";
import { applyPageMetadata, metadataForRoute } from "@/lib/site-metadata.ts";
import { resolveSiteRoute, sitePath } from "@/lib/routes.ts";
import { trackPageview } from "@/lib/events.ts";

const LandingPage = lazy(() => import("@/pages/LandingPage.tsx"));
const AgentsPage = lazy(() => import("@/pages/AgentsPage.tsx"));
const ClassicReviewPage = lazy(() => import("@/pages/ClassicReviewPage.tsx"));
const ReviewStudioPage = lazy(() => import("@/pages/ReviewStudioPage.tsx"));

function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const route = resolveSiteRoute(location.pathname);
    applyPageMetadata(metadataForRoute(route));
    trackPageview(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-dvh flex-col gap-3 bg-background p-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-full max-w-xl" />
      <Skeleton className="h-64 w-full max-w-3xl" />
    </div>
  );
}

/** Route tree without a router wrapper — use inside BrowserRouter, MemoryRouter, or RouterProvider. */
export function SiteAppRoutes() {
  return (
    <>
      <LegacyViewRedirect />
      <RouteMetadata />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path={sitePath("landing")} element={<LandingPage />} />
          <Route path={sitePath("review")} element={<ReviewStudioPage />} />
          <Route path={sitePath("agents")} element={<AgentsPage />} />
          <Route path={sitePath("classic")} element={<ClassicReviewPage />} />
          <Route path="*" element={<Navigate to={sitePath("landing")} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function SiteApp() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <SiteAppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  );
}
