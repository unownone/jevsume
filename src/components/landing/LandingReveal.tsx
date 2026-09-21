import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils.ts";
import { LANDING_REVEAL_BASE, landingRevealVisible } from "@/components/landing/landing-motion.ts";
import { useInViewOnce } from "@/components/landing/useInViewOnce.ts";
import { revealVariants, resolveRevealTransition, usePrefersReducedMotion } from "@/lib/prosume-motion.ts";

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  initialShown?: boolean;
} & Omit<ComponentPropsWithoutRef<"section">, "className" | "children">;

export function LandingReveal({
  children,
  className,
  as = "div",
  initialShown = false,
  ...rest
}: LandingRevealProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, visible } = useInViewOnce<HTMLElement>();
  const shown = initialShown || visible || reduced;
  const Tag = motion[as];

  return (
    <Tag
      ref={ref as never}
      className={cn(LANDING_REVEAL_BASE, landingRevealVisible(shown), className)}
      data-landing-reveal={shown ? "shown" : "pending"}
      variants={revealVariants}
      initial={reduced ? false : "hidden"}
      animate={shown ? "visible" : "hidden"}
      transition={resolveRevealTransition(reduced)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
