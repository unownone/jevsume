import type { Transition, Variants } from "framer-motion";
import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export const SCORE_SPRING = { type: "spring" as const, stiffness: 120, damping: 18, mass: 0.85 };
export const CONTROL_EASE: Transition = { type: "tween", duration: 0.18, ease: [0.22, 1, 0.36, 1] };
export const PANEL_TRANSITION: Transition = { type: "tween", duration: 0.26, ease: [0.22, 1, 0.36, 1] };
export const REVEAL_TRANSITION: Transition = { type: "tween", duration: 0.62, ease: [0.22, 1, 0.36, 1] };
export const STAGGER_CHILDREN = 0.07;

export const revealVariants: Variants = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };
export const staggerContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_CHILDREN, delayChildren: 0.04 } },
} as unknown as Variants;
export const staggerItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: REVEAL_TRANSITION },
} as unknown as Variants;
export const panelVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export function instantTransition(): Transition {
  return { type: "tween", duration: 0 };
}

export function resolveSpringTransition(reduced: boolean) {
  return reduced ? instantTransition() : SCORE_SPRING;
}

export function resolveControlTransition(reduced: boolean) {
  return reduced ? instantTransition() : CONTROL_EASE;
}

export function resolvePanelTransition(reduced: boolean) {
  return reduced ? instantTransition() : PANEL_TRANSITION;
}

export function resolveRevealTransition(reduced: boolean) {
  return reduced ? instantTransition() : REVEAL_TRANSITION;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

type MatchMediaRoot = {
  matchMedia?: (query: string) => {
    matches: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
};

export function readPrefersReducedMotion(): boolean {
  const root = globalThis as MatchMediaRoot;
  if (typeof root.matchMedia !== "function") {
    return false;
  }
  return root.matchMedia(REDUCED_QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => readPrefersReducedMotion());

  useEffect(() => {
    const root = globalThis as MatchMediaRoot;
    if (typeof root.matchMedia !== "function") {
      return;
    }
    const media = root.matchMedia(REDUCED_QUERY);
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function useAnimatedScore(target: number) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    if (reduced) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    const from = currentRef.current;
    if (from === target) {
      setDisplay(Math.round(target));
      return;
    }

    const controls = animate(from, target, {
      ...SCORE_SPRING,
      onUpdate: (value) => {
        currentRef.current = value;
        setDisplay(Math.round(value));
      },
    });

    return () => controls.stop();
  }, [reduced, target]);

  return display;
}

export function animatedScoreStep(
  from: number,
  to: number,
  reduced: boolean,
): { immediate: number } | { from: number; to: number; transition: ReturnType<typeof resolveSpringTransition> } {
  if (reduced) {
    return { immediate: to };
  }
  return { from, to, transition: resolveSpringTransition(false) };
}

export function useAnimatedNumber(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(() => (active ? target : 0));
  const currentRef = useRef(active ? target : 0);

  useEffect(() => {
    if (!active) {
      currentRef.current = 0;
      setValue(0);
      return;
    }

    if (readPrefersReducedMotion()) {
      currentRef.current = target;
      setValue(target);
      return;
    }

    const from = currentRef.current;
    const controls = animate(from, target, {
      type: "tween",
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (next) => {
        currentRef.current = next;
        setValue(Math.round(next));
      },
    });

    return () => controls.stop();
  }, [active, durationMs, target]);

  return value;
}

export function useAnimatedScoreSpring(target: number, active: boolean) {
  const [value, setValue] = useState(() => (active ? target : 0));
  const currentRef = useRef(active ? target : 0);

  useEffect(() => {
    if (!active) {
      currentRef.current = 0;
      setValue(0);
      return;
    }

    if (readPrefersReducedMotion()) {
      currentRef.current = target;
      setValue(target);
      return;
    }

    const from = currentRef.current;
    const controls = animate(from, target, {
      ...SCORE_SPRING,
      onUpdate: (next) => {
        currentRef.current = next;
        setValue(Math.round(next));
      },
    });

    return () => controls.stop();
  }, [active, target]);

  return value;
}
