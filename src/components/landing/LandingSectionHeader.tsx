import { cn } from "@/lib/utils.ts";

type LandingSectionHeaderProps = {
  index: string;
  slug: string;
  title: string;
  status?: string;
  description?: string;
  className?: string;
};

export function LandingSectionHeader({
  index,
  slug,
  title,
  status,
  description,
  className,
}: LandingSectionHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 border-b border-border/60 pb-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
          {index} // {slug}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
      </div>
      {status ? (
        <p className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground md:text-right">
          {status}
        </p>
      ) : null}
    </header>
  );
}
