import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import { LOCAL_MCP_COMMAND, MCP_PATH } from "@/lib/site-links.ts";

type ClientId = "cursor" | "claude" | "claude-code" | "codex" | "generic";

function hostedSnippet(origin: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        jevsume: {
          url: `${origin}${MCP_PATH}`,
        },
      },
    },
    null,
    2,
  );
}

function localSnippet(windows: boolean): string {
  if (windows) {
    return JSON.stringify(
      {
        mcpServers: {
          jevsume: {
            command: "cmd",
            args: ["/c", "npx", "-y", "github:unownone/jevsume"],
            env: {
              TYPESAFE_API_KEY: "YOUR_TYPESAFE_API_KEY",
            },
          },
        },
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      mcpServers: {
        jevsume: {
          command: "npx",
          args: ["-y", "github:unownone/jevsume"],
          env: {
            TYPESAFE_API_KEY: "YOUR_TYPESAFE_API_KEY",
          },
        },
      },
    },
    null,
    2,
  );
}

const CLIENT_LABELS: Record<ClientId, string> = {
  cursor: "Cursor",
  claude: "Claude Desktop",
  "claude-code": "Claude Code",
  codex: "Codex / Codex Chat",
  generic: "Generic MCP",
};

type McpSetupSnippetProps = {
  client?: ClientId;
};

export function McpSetupSnippet({ client = "generic" }: McpSetupSnippetProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-worker.example";
  const windows =
    typeof navigator !== "undefined" && client === "claude" && /Win/i.test(navigator.userAgent);
  const hosted = useMemo(() => hostedSnippet(origin), [origin]);
  const local = useMemo(() => localSnippet(windows), [windows]);

  return (
    <div className="flex flex-col gap-2">
      <Tabs defaultValue="hosted">
        <TabsList aria-label="MCP mode">
          <TabsTrigger value="hosted">Hosted</TabsTrigger>
          <TabsTrigger value="local">Local npx</TabsTrigger>
        </TabsList>
        <TabsContent value="hosted" className="mt-3">
          <SnippetBlock label={`${CLIENT_LABELS[client]} · hosted ${MCP_PATH}`} text={hosted} />
        </TabsContent>
        <TabsContent value="local" className="mt-3">
          <SnippetBlock label={`${CLIENT_LABELS[client]} · ${LOCAL_MCP_COMMAND}`} text={local} />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Paste into your host MCP config. Replace YOUR_TYPESAFE_API_KEY for local runs.
      </p>
    </div>
  );
}

function SnippetBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(text);
          }}
        >
          Copy
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto p-3 text-xs leading-relaxed text-foreground">
        <code>{text}</code>
      </pre>
    </div>
  );
}
