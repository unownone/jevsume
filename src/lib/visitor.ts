const KEY = "jevsume_vid";

function cookieVisitorId(): string | null {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${KEY}=`));
  if (!match) {
    return null;
  }
  const value = match.slice(KEY.length + 1);
  return value.length >= 8 ? value : null;
}

export function loadVisitorId(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && stored.length >= 8) {
      return stored;
    }
  } catch {
    // private mode
  }
  return cookieVisitorId() ?? crypto.randomUUID();
}

export function persistVisitorId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // private mode
  }
  document.cookie = `${KEY}=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
