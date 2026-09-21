import { cn } from "@/lib/utils.ts";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/site-copy.ts";

type BrandMarkProps = {
  className?: string;
  size?: number;
};

export function BrandMark({ className, size = 32 }: BrandMarkProps) {
  return (
    <img
      className={cn("rounded-md border border-border bg-card", className)}
      src="/jev-mark.svg"
      width={size}
      height={size}
      alt=""
      decoding="async"
    />
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-foreground">
        Pro<span className="text-primary">-sume</span>
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{BRAND_TAGLINE}</span>
    </div>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={32} />
      <BrandWordmark />
      <span className="sr-only">{BRAND_NAME}</span>
    </div>
  );
}
