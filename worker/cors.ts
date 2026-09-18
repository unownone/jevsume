/**
 * Same-origin CORS only. The SPA and Hono API share one Worker, so browsers
 * should call `/api/*` from that origin. Cross-site pages must not read responses.
 */
export function allowCorsOrigin(
  requestOrigin: string | undefined,
  requestUrl: string,
): string | undefined {
  if (!requestOrigin) {
    return undefined;
  }
  try {
    const origin = new URL(requestOrigin).origin;
    const workerOrigin = new URL(requestUrl).origin;
    if (origin === workerOrigin) {
      return origin;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
