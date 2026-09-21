import { cn } from "@/lib/utils.ts";

export const LANDING_CARD_INTERACTION = cn(
  "border-border/80 bg-card/80 shadow-sm",
  "motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200",
  "motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/35 motion-safe:hover:shadow-[0_12px_40px_-24px_rgba(232,197,114,0.45)]",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
);

export const LANDING_REVEAL_BASE = cn(
  "landing-reveal",
  "motion-reduce:opacity-100 motion-reduce:translate-y-0",
);

export function landingRevealVisible(visible: boolean) {
  return visible ? "landing-reveal--visible" : undefined;
}
