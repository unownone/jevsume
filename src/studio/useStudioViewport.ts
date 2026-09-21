import { useEffect, useState } from "react";

/** Stitch studio breakpoint: desktop workspace at 1024px and up. */
export const STUDIO_NARROW_QUERY = "(max-width: 1023px)";

export function useStudioViewport() {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(STUDIO_NARROW_QUERY).matches : false,
  );

  useEffect(() => {
    const query = window.matchMedia(STUDIO_NARROW_QUERY);
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return { isNarrow, isWide: !isNarrow };
}
