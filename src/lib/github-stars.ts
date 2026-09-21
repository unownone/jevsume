const FALLBACK_STARS = 0;

export function formatStarCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) {
    return String(FALLBACK_STARS);
  }
  if (count >= 1000) {
    const rounded = count / 1000;
    const oneDecimal = Math.round(rounded * 10) / 10;
    return `${oneDecimal}k`;
  }
  return String(Math.floor(count));
}

export async function fetchGitHubStarCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch("https://api.github.com/repos/unownone/jevsume", {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { stargazers_count?: number };
    if (typeof body.stargazers_count !== "number") {
      return null;
    }
    return body.stargazers_count;
  } catch {
    return null;
  }
}
