import {
  MAX_EVENT_PAGE_LENGTH,
  isWebsiteEventType,
  type WebsiteEventType,
} from "../shared/events.ts";

/**
 * Dataset: website_events
 *
 * blobs:
 *   blob1: event_type  (`pageview` | `click`)
 *   blob2: page        (pathname, or a named action like `/review`)
 *   blob3: country     (`cf-ipcountry`, or `XX` when missing)
 *
 * doubles:
 *   double1: count     (always 1)
 *
 * indexes:
 *   index1: event_id   (uuid)
 *
 * Example queries:
 *   SELECT blob2 AS page, SUM(double1) AS views
 *   FROM website_events
 *   WHERE blob1 = 'pageview' AND timestamp >= NOW() - INTERVAL '7' DAY
 *   GROUP BY page
 *
 *   SELECT blob2 AS action, blob3 AS country, SUM(double1) AS clicks
 *   FROM website_events
 *   WHERE blob1 = 'click' AND timestamp >= NOW() - INTERVAL '7' DAY
 *   GROUP BY action, country
 */
export type WebsiteEvent = {
  type: WebsiteEventType;
  page: string;
  country: string;
  id?: string;
};

export function requestCountry(request: Request): string {
  return request.headers.get("cf-ipcountry") || "XX";
}

export function sanitizeEventPage(value: string): string {
  const page = value.trim().slice(0, MAX_EVENT_PAGE_LENGTH);
  return page;
}

export function writeWebsiteEvent(
  dataset: AnalyticsEngineDataset | undefined,
  event: WebsiteEvent,
): void {
  if (!dataset) {
    return;
  }
  const type: WebsiteEventType = event.type;
  switch (type) {
    case "pageview":
    case "click":
      break;
    default: {
      const _never: never = type;
      return _never;
    }
  }
  dataset.writeDataPoint({
    blobs: [type, sanitizeEventPage(event.page), event.country || "XX"],
    doubles: [1],
    indexes: [event.id ?? crypto.randomUUID()],
  });
}

export function parseWebsiteEventType(value: string | undefined): WebsiteEventType | undefined {
  const type = value?.trim();
  if (!type || !isWebsiteEventType(type)) {
    return undefined;
  }
  return type;
}
