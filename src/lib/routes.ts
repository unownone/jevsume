export const SITE_ROUTES = {
  landing: "/",
  review: "/review",
  agents: "/agents",
  classic: "/classic",
} as const;

export type SiteRouteId = keyof typeof SITE_ROUTES;

const PATH_TO_ROUTE: Record<string, SiteRouteId> = {
  "/": "landing",
  "/review": "review",
  "/agents": "agents",
  "/classic": "classic",
};

export function resolveSiteRoute(pathname: string): SiteRouteId {
  return PATH_TO_ROUTE[pathname] ?? "landing";
}

export function matchPath(currentPath: string, targetPath: string): boolean {
  const normalized = currentPath.split("?")[0]?.replace(/\/$/, "") || "/";
  const target = targetPath.replace(/\/$/, "") || "/";
  return normalized === target;
}

export function sitePath(id: SiteRouteId): string {
  return SITE_ROUTES[id];
}
