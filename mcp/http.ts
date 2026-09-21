import {
  handleJsonRpcMessages,
  parseJsonRpcMessages,
  type JsonRpcResponse,
} from "./protocol.ts";
import { MCP_PROTOCOL_VERSION } from "./compact.ts";
import type { McpToolRuntime } from "./tools.ts";

export const MCP_PATH = "/mcp";

const ALLOW_HEADERS = [
  "Content-Type",
  "Accept",
  "Mcp-Session-Id",
  "MCP-Protocol-Version",
  "Last-Event-ID",
].join(", ");

const INSTALL_PAGE = `<!doctype html>
<meta charset="utf-8">
<title>jevsume MCP</title>
<body style="font:16px/1.4 system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem">
<h1>jevsume MCP</h1>
<p>Streamable HTTP endpoint for compact Jev resume review. Connect an MCP client to this URL.</p>
<pre>POST ${MCP_PATH}</pre>
<p>Local (your TypeSafe key):</p>
<pre>npx -y github:unownone/jevsume -- --api-key $TYPESAFE_API_KEY</pre>
<p>Skill: <code>skills/jevsume-resume/SKILL.md</code></p>
</body>`;

export function mcpCorsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response("Forbidden origin", { status: 403, headers: mcpCorsHeaders(null) });
  }
  for (const [key, value] of Object.entries(mcpCorsHeaders(origin))) {
    headers.set(key, value);
  }
  headers.set("MCP-Protocol-Version", request.headers.get("MCP-Protocol-Version") ?? MCP_PROTOCOL_VERSION);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(payload: unknown): Response {
  const frames = Array.isArray(payload) ? payload : [payload];
  const text = frames.map((item) => `event: message\ndata: ${JSON.stringify(item)}\n\n`).join("");
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function prefersSse(accept: string): boolean {
  return accept.includes("text/event-stream") && !accept.includes("application/json");
}

function prefersHtml(accept: string): boolean {
  return accept.includes("text/html");
}

function encodeResponses(responses: JsonRpcResponse[], accept: string): Response {
  if (responses.length === 0) {
    return new Response(null, { status: 202 });
  }
  const payload = responses.length === 1 ? responses[0] : responses;
  if (prefersSse(accept)) {
    return sseResponse(payload);
  }
  return jsonResponse(payload);
}

export async function handleMcpHttp(request: Request, runtime: McpToolRuntime): Promise<Response> {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response("Forbidden origin", { status: 403, headers: mcpCorsHeaders(null) });
  }

  if (request.method === "OPTIONS") {
    return withCors(request, new Response(null, { status: 204 }));
  }

  if (request.method === "GET") {
    const accept = request.headers.get("Accept") ?? "";
    if (prefersHtml(accept) || accept === "" || accept.includes("*/*")) {
      // Browsers send */* or html. MCP SSE clients send text/event-stream.
      if (accept.includes("text/event-stream") && !prefersHtml(accept)) {
        return withCors(request, new Response("SSE not offered", { status: 405, headers: { Allow: "POST, OPTIONS" } }));
      }
      if (prefersHtml(accept) || accept === "" || (accept.includes("*/*") && !accept.includes("text/event-stream"))) {
        return withCors(
          request,
          new Response(INSTALL_PAGE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }),
        );
      }
    }
    return withCors(request, new Response("SSE not offered", { status: 405, headers: { Allow: "POST, OPTIONS" } }));
  }

  if (request.method === "DELETE") {
    return withCors(request, new Response("No session to delete", { status: 405, headers: { Allow: "POST, OPTIONS" } }));
  }

  if (request.method !== "POST") {
    return withCors(request, new Response("Method not allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } }));
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return withCors(
      request,
      jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400),
    );
  }

  const messages = parseJsonRpcMessages(parsed);
  if ("parseError" in messages) {
    return withCors(
      request,
      jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: messages.parseError } }, 400),
    );
  }

  const responses = await handleJsonRpcMessages(messages, runtime);
  return withCors(request, encodeResponses(responses, request.headers.get("Accept") ?? ""));
}
