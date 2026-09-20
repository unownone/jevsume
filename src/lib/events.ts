import type { WebsiteEventType } from "../../shared/events.ts";

export type { WebsiteEventType };

function currentPage(): string {
  const location = (globalThis as { location?: { pathname?: string; search?: string } }).location;
  if (!location) {
    return "/";
  }
  return `${location.pathname ?? ""}${location.search ?? ""}` || "/";
}

export function trackWebsiteEvent(type: WebsiteEventType, page: string): void {
  const body = JSON.stringify({ type, page });
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => undefined);
}

export function trackPageview(page = currentPage()): void {
  trackWebsiteEvent("pageview", page || "/");
}

export function trackClick(page: string): void {
  trackWebsiteEvent("click", page);
}
