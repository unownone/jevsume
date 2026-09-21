import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import LandingPage from "@/pages/LandingPage.tsx";
import AgentsPage from "@/pages/AgentsPage.tsx";
import ClassicReviewPage from "@/pages/ClassicReviewPage.tsx";
import ReviewStudioPage from "@/pages/ReviewStudioPage.tsx";
import { applyPageMetadata, metadataForRoute } from "@/lib/site-metadata.ts";
import { resolveSiteRoute, sitePath } from "@/lib/routes.ts";
import { trackPageview } from "@/lib/events.ts";

function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const route = resolveSiteRoute(location.pathname);
    applyPageMetadata(metadataForRoute(route));
    trackPageview(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}

export default function SiteApp() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <RouteMetadata />
        <Routes>
          <Route path={sitePath("landing")} element={<LandingPage />} />
          <Route path={sitePath("review")} element={<ReviewStudioPage />} />
          <Route path={sitePath("agents")} element={<AgentsPage />} />
          <Route path={sitePath("classic")} element={<ClassicReviewPage />} />
          <Route path="*" element={<Navigate to={sitePath("landing")} replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
