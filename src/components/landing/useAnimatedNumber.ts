import { useEffect, useState } from "react";

export function useAnimatedNumber(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(() => (active ? target : 0));

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, durationMs, target]);

  return value;
}
