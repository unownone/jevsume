import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { McpSnippetBlock } from "@/components/prosume/McpSnippetBlock.tsx";
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
        <McpSnippetBlock snippet={snippet} />
      </CardContent>
    </Card>
  );
}
