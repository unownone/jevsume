/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  instantTransition,
  PANEL_TRANSITION,
  resolvePanelTransition,
  resolveRevealTransition,
  resolveSpringTransition,
  SCORE_SPRING,
} from "../src/lib/prosume-motion.ts";
import { animatedScoreStep } from "../src/lib/prosume-motion.ts";
import { readPrefersReducedMotion } from "../src/lib/prosume-motion.ts";

describe("motion presets", () => {
  it("uses spring config for score dials when motion is allowed", () => {
    expect(resolveSpringTransition(false)).toMatchObject(SCORE_SPRING);
  });
  it("falls back to instant transitions when reduced motion is requested", () => {
    expect(resolveSpringTransition(true)).toEqual(instantTransition());
    expect(resolvePanelTransition(true)).toEqual(instantTransition());
    expect(resolveRevealTransition(true)).toEqual(instantTransition());
  });
  it("keeps panel transitions within the 180–320ms band", () => {
    expect(PANEL_TRANSITION.duration).toBeGreaterThanOrEqual(0.18);
    expect(PANEL_TRANSITION.duration).toBeLessThanOrEqual(0.32);
  });
  it("describes bidirectional score steps", () => {
    expect(animatedScoreStep(82, 65, true)).toEqual({ immediate: 65 });
    expect(animatedScoreStep(82, 65, false)).toMatchObject({ from: 82, to: 65 });
  });
  it("reads prefers-reduced-motion in jsdom", () => {
    expect(readPrefersReducedMotion()).toBe(false);
  });
});
