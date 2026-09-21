import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { genericHostedSnippet } from "@/lib/mcp-snippets.ts";
import { MCP_PATH } from "@/lib/site-links.ts";

type HostedMcpPanelProps = {
  origin: string;
};

export function HostedMcpPanel({ origin }: HostedMcpPanelProps) {
  const snippet = genericHostedSnippet(origin);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hosted MCP (all URL-based clients)</CardTitle>
        <CardDescription>
          Streamable HTTP at <code className="rounded bg-muted px-1">{MCP_PATH}</code> on this origin — Worker endpoint,
          not the setup page at /agents. Client tabs below add host-specific hosted/local formats where they differ.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SnippetBlock snippet={snippet} />
      </CardContent>
    </Card>
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
