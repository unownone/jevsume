import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";
import { LANDING_REVEAL_BASE, landingRevealVisible } from "@/components/landing/landing-motion.ts";
import { useInViewOnce } from "@/components/landing/useInViewOnce.ts";

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
};

export function LandingReveal({ children, className, as: Tag = "div" }: LandingRevealProps) {
  const { ref, visible } = useInViewOnce<HTMLElement>();
  return (
    <Tag
      ref={ref as never}
      className={cn(LANDING_REVEAL_BASE, landingRevealVisible(visible), className)}
    >
      {children}
    </Tag>
  );
}
