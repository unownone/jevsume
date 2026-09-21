import type { ReactNode } from "react";
import { SiteHeader } from "@/components/prosume/SiteHeader.tsx";
import { SiteFooter } from "@/components/SiteFooter.tsx";

type SiteShellProps = {
  children: ReactNode;
  headerEnd?: ReactNode;
  hideFooter?: boolean;
};

export function SiteShell({ children, headerEnd, hideFooter }: SiteShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader endSlot={headerEnd} />
      <div className="flex flex-1 flex-col">{children}</div>
      {hideFooter ? null : <SiteFooter />}
    </div>
  );
}
