import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Menu, Star } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet.tsx";
import { BrandLockup } from "@/components/prosume/BrandMark.tsx";
import { fetchGitHubStarCount, formatStarCount } from "@/lib/github-stars.ts";
import { trackClick } from "@/lib/events.ts";
import { GITHUB_REPO_URL } from "@/lib/site-links.ts";
import { sitePath } from "@/lib/routes.ts";
import { cn } from "@/lib/utils.ts";

const NAV = [
  { id: "landing", label: "Overview", to: sitePath("landing") },
  { id: "review", label: "Resume review", to: sitePath("review") },
  { id: "agents", label: "MCP setup", to: sitePath("agents") },
] as const;

type SiteHeaderProps = {
  endSlot?: React.ReactNode;
};

export function SiteHeader({ endSlot }: SiteHeaderProps) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchGitHubStarCount(controller.signal).then(setStars);
    return () => controller.abort();
  }, []);

  const starLabel = stars === null ? "GitHub" : formatStarCount(stars);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link to={sitePath("landing")} className="shrink-0" onClick={() => trackClick("/nav-home")}>
            <BrandLockup />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === sitePath("landing")}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-muted text-primary"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )
                }
                onClick={() => trackClick(`/nav-${item.id}`)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={`GitHub repository${stars === null ? "" : `, ${stars} stars`}`}
              onClick={() => trackClick("/github-stars")}
            >
              <Star data-icon="inline-start" className="text-primary" />
              {starLabel}
            </a>
          </Button>
          <Button size="sm" asChild className="hidden md:inline-flex">
            <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-header")}>
              Review resume
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          {endSlot}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-4">
              <SheetTitle className="sr-only">Site navigation</SheetTitle>
              <BrandLockup />
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {NAV.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.to === sitePath("landing")}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-3 py-2 text-sm",
                        isActive ? "bg-muted text-primary" : "text-muted-foreground",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <Button asChild>
                <Link to={sitePath("review")}>Review resume</Link>
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
