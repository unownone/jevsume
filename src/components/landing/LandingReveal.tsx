import type { ReactNode } from "react";
import { MotionReveal } from "@/components/prosume-motion-ui.tsx";

export function LandingReveal({
  children,
  className,
  as = "div",
  viewportAmount,
  "data-landing-section": section,
  "aria-labelledby": labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  viewportAmount?: number;
  "data-landing-section"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <MotionReveal
      as={as}
      className={className}
      landingCompat
      viewportAmount={viewportAmount}
      data-landing-section={section}
      aria-labelledby={labelledBy}
    >
      {children}
    </MotionReveal>
  );
}
