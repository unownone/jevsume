import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bolt,
  Cloud,
  Copy,
  Server,
  Shield,
  Terminal,
  Wrench,
} from "lucide-react";
import { SiteShell } from "@/components/prosume/SiteShell.tsx";
import { McpSetupSnippet } from "@/components/prosume/McpSetupSnippet.tsx";
import { McpSnippetBlock } from "@/components/prosume/McpSnippetBlock.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { AGENTS_MCP_TOOLS } from "@/lib/agents-mcp-tools.ts";
import { agentsCopy } from "@/lib/site-copy.ts";
import { genericHostedSnippet, hostedMcpUrl, type McpClientId } from "@/lib/mcp-snippets.ts";
import { AGENTS_PATH, DOCS_MCP_LOCAL_URL, LOCAL_MCP_COMMAND, MCP_PATH } from "@/lib/site-links.ts";
import { sitePath } from "@/lib/routes.ts";
import { trackClick } from "@/lib/events.ts";
import { cn } from "@/lib/utils.ts";

const CLIENT_TABS: { id: McpClientId; label: string; configPath: string }[] = [
  { id: "cursor", label: "Cursor", configPath: ".cursor/mcp.json or ~/.cursor/mcp.json" },
  { id: "claude", label: "Claude Desktop", configPath: "claude_desktop_config.json" },
  { id: "claude-code", label: "Claude Code", configPath: "~/.claude.json or project .mcp.json" },
  { id: "codex", label: "Codex CLI", configPath: "~/.codex/config.toml" },
  { id: "codex-chat", label: "Codex Chat", configPath: "shared ~/.codex/config.toml" },
  { id: "generic", label: "Generic", configPath: "host MCP manifest" },
];

const TAB_PANEL_MOTION =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200 motion-reduce:animate-none motion-reduce:transition-none";

export default function AgentsPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-worker.example";
  const workbenchRef = useRef<HTMLDivElement>(null);
  const [connectionMode, setConnectionMode] = useState<"hosted" | "local">("hosted");
  const [clientTab, setClientTab] = useState<McpClientId>("cursor");
  const [urlCopied, setUrlCopied] = useState(false);

  const hostedUrl = hostedMcpUrl(origin);
  const hostedSnippet = genericHostedSnippet(origin);
  const localCommandSnippet = {
    label: `Local stdio · ${LOCAL_MCP_COMMAND}`,
    text: `${LOCAL_MCP_COMMAND}\n# Set TYPESAFE_API_KEY in your MCP host env before starting.`,
  };

  const scrollToWorkbench = useCallback(() => {
    workbenchRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  const copyHostedUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hostedUrl);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      setUrlCopied(false);
    }
  }, [hostedUrl]);

  const activeClient = CLIENT_TABS.find((t) => t.id === clientTab) ?? CLIENT_TABS[0];

  return (
    <SiteShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 md:px-6 md:py-12">
        <section className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,rgba(232,197,114,0.12),transparent_65%)]"
            aria-hidden
          />
          <header className="relative flex flex-col gap-4">
            <Badge variant="secondary" className="w-fit gap-2">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {agentsCopy.eyebrow}
            </Badge>
            <div>
              <p className="text-sm text-muted-foreground">Setup · {AGENTS_PATH}</p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
                {agentsCopy.title}
              </h1>
            </div>
            <p className="max-w-2xl text-muted-foreground">{agentsCopy.intro}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="min-w-[10rem]">
                <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-agents-hero")}>
                  {agentsCopy.heroReviewCta}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" type="button" className="min-w-[10rem]" onClick={scrollToWorkbench}>
                {agentsCopy.heroConnectCta}
                <Bolt data-icon="inline-end" className="text-primary" />
              </Button>
            </div>
          </header>

          <aside className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatusCard label={agentsCopy.gatewayLabel} value={agentsCopy.gatewayValue} />
            <StatusCard label={agentsCopy.protocolLabel} value={agentsCopy.protocolValue} />
          </aside>
        </section>

        <section aria-labelledby="connection-heading">
          <h2 id="connection-heading" className="sr-only">Connection mode</h2>
          <Tabs
            value={connectionMode}
            onValueChange={(value) => {
              if (value === "hosted" || value === "local") {
                setConnectionMode(value);
              }
            }}
            className="gap-6"
          >
            <TabsList
              variant="line"
              className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 md:grid-cols-2"
              aria-label="MCP connection mode"
            >
              <TabsTrigger
                value="hosted"
                className={cn(
                  "h-auto min-h-[7.5rem] flex-col items-start gap-2 rounded-xl border border-border bg-card/60 px-4 py-4 text-left shadow-none",
                  "data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground",
                  "after:hidden motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200",
                  "data-[state=active]:motion-safe:shadow-[0_0_0_1px_var(--primary)]",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <Cloud className="size-5 text-primary" aria-hidden />
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {agentsCopy.hostedBadge}
                  </Badge>
                </div>
                <span className="font-[family-name:var(--font-display)] text-base font-semibold">
                  Option 01 · {agentsCopy.hostedTitle}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-2">{agentsCopy.hostedBody}</span>
              </TabsTrigger>
              <TabsTrigger
                value="local"
                className={cn(
                  "h-auto min-h-[7.5rem] flex-col items-start gap-2 rounded-xl border border-border bg-card/60 px-4 py-4 text-left shadow-none",
                  "data-[state=active]:border-primary data-[state=active]:bg-card data-[state=active]:text-foreground",
                  "after:hidden motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200",
                  "data-[state=active]:motion-safe:shadow-[0_0_0_1px_var(--primary)]",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <Terminal className="size-5 text-primary" aria-hidden />
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {agentsCopy.localBadge}
                  </Badge>
                </div>
                <span className="font-[family-name:var(--font-display)] text-base font-semibold">
                  Option 02 · {agentsCopy.localTitle}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-2">{agentsCopy.localBody}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hosted" className={TAB_PANEL_MOTION}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hosted MCP (all URL-based clients)</CardTitle>
                  <CardDescription>
                    Streamable HTTP at <code className="rounded bg-muted px-1">{MCP_PATH}</code> — Worker endpoint, not
                    this setup page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                      {hostedUrl}
                    </code>
                    <Button type="button" variant="secondary" onClick={() => void copyHostedUrl()}>
                      {urlCopied ? "Copied" : "Copy URL"}
                      <Copy data-icon="inline-end" className="opacity-70" />
                    </Button>
                  </div>
                  <McpSnippetBlock snippet={hostedSnippet} copyLabel="Copy JSON" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="local" className={TAB_PANEL_MOTION}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{agentsCopy.localTitle}</CardTitle>
                  <CardDescription>{agentsCopy.localBody}</CardDescription>
                </CardHeader>
                <CardContent>
                  <McpSnippetBlock snippet={localCommandSnippet} copyLabel="Copy command" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        <section ref={workbenchRef} id="client-configs" aria-labelledby="workbench-heading" className="scroll-mt-20">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">{agentsCopy.workbenchEyebrow}</p>
              <h2
                id="workbench-heading"
                className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight"
              >
                {agentsCopy.workbenchTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{agentsCopy.workbenchHint}</p>
            </div>
            <Badge variant="secondary" className="w-fit capitalize">
              {connectionMode} · {activeClient.label}
            </Badge>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Tabs
                value={clientTab}
                onValueChange={(value) => setClientTab(value as McpClientId)}
                className="gap-4"
              >
                <TabsList
                  variant="line"
                  className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0"
                  aria-label="MCP client host"
                >
                  {CLIENT_TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={cn(
                        "rounded-md px-3 py-2 motion-safe:transition-colors motion-safe:duration-200",
                        "data-[state=active]:bg-muted data-[state=active]:text-primary",
                      )}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {CLIENT_TABS.map((tab) => (
                  <TabsContent
                    key={tab.id}
                    value={tab.id}
                    className={cn("mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]", TAB_PANEL_MOTION)}
                  >
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Config path: <code className="rounded bg-muted px-1">{tab.configPath}</code>
                      </p>
                      <McpSetupSnippet client={tab.id} mode={connectionMode} />
                    </div>
                    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Wrench className="size-4 text-primary" aria-hidden />
                        {agentsCopy.activationTitle}
                      </div>
                      <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                        {agentsCopy.activationSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <Button asChild className="w-full">
                        <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-agents-workbench")}>
                          {agentsCopy.heroReviewCta}
                          <ArrowRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="tools-heading">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">{agentsCopy.toolsEyebrow}</p>
          <h2 id="tools-heading" className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {agentsCopy.toolsTitle}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {AGENTS_MCP_TOOLS.map((tool) => (
              <Card key={tool.name} className="border-border/80 bg-card/50">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-mono text-sm">{tool.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px] uppercase">Tool</Badge>
                  </div>
                  <CardDescription className="text-sm">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-xs text-muted-foreground">args: {tool.args}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/60 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <Shield className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">{agentsCopy.privacyTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{agentsCopy.privacyBody}</p>
                <p className="mt-3 text-sm">
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={DOCS_MCP_LOCAL_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    docs/mcp-local.md on GitHub
                  </a>
                </p>
              </div>
            </div>
            <Button variant="outline" asChild className="shrink-0">
              <a href={DOCS_MCP_LOCAL_URL} target="_blank" rel="noreferrer">
                Local MCP docs
                <Server data-icon="inline-end" className="opacity-70" />
              </a>
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-card to-muted/30 p-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Ready to score a resume?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Use the browser studio or call review_resume from your connected MCP host with the same Jev lenses.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={sitePath("review")} onClick={() => trackClick("/cta-review-agents-footer")}>
                {agentsCopy.footerReviewCta}
              </Link>
            </Button>
            <Button size="lg" variant="outline" type="button" onClick={() => void copyHostedUrl()}>
              {agentsCopy.footerMcpCta}
              <Copy data-icon="inline-end" />
            </Button>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/70 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
