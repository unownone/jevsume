import { landingCopy } from "@/lib/site-copy.ts";
import { cn } from "@/lib/utils.ts";

export function LandingTrustBar() {
  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-center text-[0.7rem] uppercase tracking-wide text-muted-foreground",
        "sm:grid-cols-3 sm:divide-x sm:divide-border/60",
      )}
      data-landing-section="trust-bar"
      role="list"
    >
      {landingCopy.trustItems.map((item) => (
        <p key={item} role="listitem" className="sm:px-2">
          {item}
        </p>
      ))}
    </div>
  );
}
