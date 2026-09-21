import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";
import { LANDING_REVEAL_BASE, landingRevealVisible } from "@/components/landing/landing-motion.ts";
import { useInViewOnce } from "@/components/landing/useInViewOnce.ts";
import {
  revealVariants,
  resolveControlTransition,
  resolveRevealTransition,
  resolveSpringTransition,
  usePrefersReducedMotion,
} from "@/lib/prosume-motion.ts";

export function MotionReveal({
  children,
  className,
  as = "div",
  landingCompat = false,
  viewportAmount = 0.12,
  "data-landing-section": section,
  "aria-labelledby": labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  landingCompat?: boolean;
  viewportAmount?: number;
  "data-landing-section"?: string;
  "aria-labelledby"?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, visible } = useInViewOnce<HTMLElement>(viewportAmount);
  const Tag = motion[as];

  return (
    <Tag
      ref={ref as never}
      data-landing-section={section}
      aria-labelledby={labelledBy}
      className={cn(
        landingCompat ? LANDING_REVEAL_BASE : undefined,
        landingCompat ? landingRevealVisible(visible || reduced) : undefined,
        className,
      )}
      initial={reduced ? false : "hidden"}
      animate={reduced || visible ? "visible" : "hidden"}
      variants={revealVariants}
      transition={resolveRevealTransition(reduced)}
    >
      {children}
    </Tag>
  );
}

export function AnimatedScoreBar({
  ratio,
  className,
  delayIndex = 0,
}: {
  ratio: number;
  className?: string;
  delayIndex?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const clamped = Math.min(1, Math.max(0, ratio));

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ scaleX: clamped }}
      transition={{
        ...resolveSpringTransition(reduced),
        delay: reduced ? 0 : delayIndex * 0.05,
      }}
      style={{ transformOrigin: "left center" }}
      aria-hidden
    />
  );
}

export type LandingSegmentOption<T extends string> = { id: T; label: string };

export function LandingSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  layoutGroupId,
  "aria-label": ariaLabel,
}: {
  options: readonly LandingSegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
  layoutGroupId: string;
  "aria-label": string;
}) {
  const reduced = usePrefersReducedMotion();
  const thumbLayoutId = `${layoutGroupId}-thumb`;

  return (
    <div
      className={cn("relative inline-flex rounded-lg border border-border/80 bg-muted/40 p-1", className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option.id)}
          >
            {selected ? (
              <motion.span
                layoutId={thumbLayoutId}
                className="absolute inset-0 rounded-md border border-primary/35 bg-card shadow-sm"
                transition={resolveControlTransition(reduced)}
                aria-hidden
              />
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LandingControlReadout({
  children,
  className,
  panelKey,
}: {
  children: ReactNode;
  className?: string;
  panelKey: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      key={panelKey}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm",
        className,
      )}
      initial={reduced ? false : { opacity: 0.88, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={resolveControlTransition(reduced)}
    >
      {children}
    </motion.div>
  );
}
