import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { sitePath } from "@/lib/routes.ts";

/** Preserve legacy `?view=classic` entry while keeping `/review?scene=` fixtures. */
export function LegacyViewRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") !== "classic") {
      return;
    }
    if (location.pathname === sitePath("classic")) {
      return;
    }
    params.delete("view");
    const search = params.toString();
    navigate(
      {
        pathname: sitePath("classic"),
        search: search ? `?${search}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  return null;
}

type StudioSiteNavProps = {
  className?: string;
};

export function StudioSiteNav({ className }: StudioSiteNavProps) {
  return (
    <nav className={className} aria-label="Site">
      <Button variant="ghost" size="xs" className="h-7 px-2 text-xs" asChild>
        <Link to={sitePath("landing")}>Overview</Link>
      </Button>
      <Button variant="ghost" size="xs" className="h-7 px-2 text-xs" asChild>
        <Link to={sitePath("agents")}>MCP setup</Link>
      </Button>
    </nav>
  );
}
