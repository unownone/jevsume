import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import { mcpSnippetForClient, type McpClientId } from "@/lib/mcp-snippets.ts";

type McpSetupSnippetProps = {
  client?: McpClientId;
};

export function McpSetupSnippet({ client = "generic" }: McpSetupSnippetProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-worker.example";
  const windowsClaudeDesktop =
    typeof navigator !== "undefined" && client === "claude" && /Win/i.test(navigator.userAgent);

  const hosted = useMemo(
    () => mcpSnippetForClient(client, "hosted", origin),
    [client, origin],
  );
  const local = useMemo(
    () => mcpSnippetForClient(client, "local", origin, { windowsClaudeDesktop }),
    [client, origin, windowsClaudeDesktop],
  );

  return (
    <div className="flex flex-col gap-2">
      <Tabs defaultValue="hosted">
        <TabsList aria-label="MCP mode">
          <TabsTrigger value="hosted">Hosted</TabsTrigger>
          <TabsTrigger value="local">Local npx</TabsTrigger>
        </TabsList>
        <TabsContent value="hosted" className="mt-3">
          <SnippetBlock snippet={hosted} />
        </TabsContent>
        <TabsContent value="local" className="mt-3">
          <SnippetBlock snippet={local} />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Paste into your host MCP config. Replace YOUR_TYPESAFE_API_KEY for local runs.
      </p>
    </div>
  );
}

function SnippetBlock({ snippet }: { snippet: { label: string; text: string } }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{snippet.label}</span>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(snippet.text);
          }}
        >
          Copy
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto p-3 text-xs leading-relaxed text-foreground">
        <code>{snippet.text}</code>
      </pre>
    </div>
  );
}
