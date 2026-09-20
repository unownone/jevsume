export const WEBSITE_EVENT_TYPES = ["pageview", "click"] as const;

export type WebsiteEventType = (typeof WEBSITE_EVENT_TYPES)[number];

export const MAX_EVENT_PAGE_LENGTH = 256;

export function isWebsiteEventType(value: string): value is WebsiteEventType {
  switch (value) {
    case "pageview":
    case "click":
      return true;
    default:
      return false;
  }
}
