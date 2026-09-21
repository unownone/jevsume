import { useMemo } from "react";
import { McpSnippetBlock } from "@/components/prosume/McpSnippetBlock.tsx";
import { mcpSnippetForClient, type McpClientId, type McpSnippetMode } from "@/lib/mcp-snippets.ts";

type McpSetupSnippetProps = {
  client?: McpClientId;
  mode: McpSnippetMode;
};

export function McpSetupSnippet({ client = "generic", mode }: McpSetupSnippetProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-worker.example";
  const windowsClaudeDesktop =
    typeof navigator !== "undefined" && client === "claude" && /Win/i.test(navigator.userAgent);

  const snippet = useMemo(
    () => mcpSnippetForClient(client, mode, origin, { windowsClaudeDesktop }),
    [client, mode, origin, windowsClaudeDesktop],
  );

  return (
    <div className="flex flex-col gap-2">
      <McpSnippetBlock snippet={snippet} copyLabel={snippet.format === "json" ? "Copy JSON" : "Copy"} />
      {mode === "local" ? (
        <p className="text-xs text-muted-foreground">
          Replace YOUR_TYPESAFE_API_KEY with a key from TypeSafe. Local runs do not use the hosted Worker rate limit.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Uses this site&apos;s origin for <code className="rounded bg-muted px-1">/mcp</code> — not the /agents setup page.
        </p>
      )}
    </div>
  );
}
