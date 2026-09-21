import { Link } from "react-router-dom";
import { SiteShell } from "@/components/prosume/SiteShell.tsx";
import { McpSetupSnippet } from "@/components/prosume/McpSetupSnippet.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { agentsCopy } from "@/lib/site-copy.ts";
import { AGENTS_PATH, DOCS_MCP_LOCAL_URL, MCP_PATH } from "@/lib/site-links.ts";
import { sitePath } from "@/lib/routes.ts";
import type { McpClientId } from "@/lib/mcp-snippets.ts";

const CLIENT_TABS: { id: McpClientId; label: string }[] = [
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude Desktop" },
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex CLI" },
  { id: "codex-chat", label: "Codex Chat" },
  { id: "generic", label: "Generic" },
];

export default function AgentsPage() {
  return (
    <SiteShell>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Setup · {AGENTS_PATH}</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">{agentsCopy.title}</h1>
          <p className="text-muted-foreground">{agentsCopy.intro}</p>
        </header>

        <Alert>
          <AlertTitle>{agentsCopy.hostedTitle}</AlertTitle>
          <AlertDescription>
            {agentsCopy.hostedBody} Endpoint path: <code className="rounded bg-muted px-1">{MCP_PATH}</code> (Worker
            HTTP — not this page).
          </AlertDescription>
        </Alert>

        <Alert variant="default">
          <AlertTitle>{agentsCopy.localTitle}</AlertTitle>
          <AlertDescription>{agentsCopy.localBody}</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Client configs</CardTitle>
            <CardDescription>Copy a block into your MCP host. Hosted uses this site origin; local uses your TypeSafe key.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cursor">
              <TabsList className="flex h-auto flex-wrap">
                {CLIENT_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CLIENT_TABS.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-4">
                  <McpSetupSnippet client={tab.id} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-2 text-sm text-muted-foreground">
          <h2 className="text-base font-medium text-foreground">{agentsCopy.privacyTitle}</h2>
          <p>{agentsCopy.privacyBody}</p>
          <p>
            Full local instructions:{" "}
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={DOCS_MCP_LOCAL_URL}
              target="_blank"
              rel="noreferrer"
            >
              docs/mcp-local.md on GitHub
            </a>
            . Prefer the browser studio?{" "}
            <Link className="text-primary underline-offset-4 hover:underline" to={sitePath("review")}>
              Open review
            </Link>
            .
          </p>
        </section>
      </main>
    </SiteShell>
  );
}
