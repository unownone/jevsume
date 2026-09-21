import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export type McpSnippetBlockProps = {
  snippet: { label: string; text: string };
  copyLabel?: string;
  className?: string;
};

export function McpSnippetBlock({ snippet, copyLabel = "Copy", className }: McpSnippetBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [snippet.text]);

  return (
    <div className={cn("rounded-lg border border-border bg-muted/40", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{snippet.label}</span>
        <Button
          type="button"
          size="xs"
          variant={copied ? "default" : "secondary"}
          onClick={() => void onCopy()}
          aria-label={copied ? "Copied to clipboard" : copyLabel}
        >
          {copied ? (
            <>
              <Check data-icon="inline-start" className="text-primary-foreground" />
              Copied
            </>
          ) : (
            <>
              <Copy data-icon="inline-start" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-foreground">
        <code>{snippet.text}</code>
      </pre>
      <p className="sr-only" role="status" aria-live="polite">
        {copied ? "Configuration copied to clipboard" : ""}
      </p>
    </div>
  );
}
