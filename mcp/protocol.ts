import {
  MCP_INSTRUCTIONS,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
} from "./compact.ts";
import { callMcpTool, listMcpTools, type McpToolRuntime } from "./tools.ts";

export const SUPPORTED_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSION,
  "2025-06-18",
  "2025-11-25",
  "2024-11-05",
] as const;

export type JsonRpcId = string | number | null;

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
};

export type McpInitializeResult = {
  protocolVersion: string;
  capabilities: { tools: Record<string, never> };
  serverInfo: { name: string; version: string };
  instructions: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}

export function parseJsonRpcMessages(body: unknown): JsonRpcRequest[] | { parseError: string } {
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return { parseError: "Empty JSON-RPC batch" };
    }
    const messages: JsonRpcRequest[] = [];
    for (const item of body) {
      const parsed = asJsonRpcRequest(item);
      if (!parsed) {
        return { parseError: "Invalid JSON-RPC batch item" };
      }
      messages.push(parsed);
    }
    return messages;
  }
  const single = asJsonRpcRequest(body);
  if (!single) {
    return { parseError: "Invalid JSON-RPC message" };
  }
  return [single];
}

function asJsonRpcRequest(value: unknown): JsonRpcRequest | null {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return null;
  }
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    method: value.method,
  };
  if ("id" in value) {
    if (!isJsonRpcId(value.id)) {
      return null;
    }
    request.id = value.id;
  }
  if ("params" in value) {
    request.params = value.params;
  }
  return request;
}

function success(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

function negotiateVersion(requested: unknown): string {
  if (typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
    return requested;
  }
  return MCP_PROTOCOL_VERSION;
}

export function initializeResult(requestedVersion?: unknown): McpInitializeResult {
  return {
    protocolVersion: negotiateVersion(requestedVersion),
    capabilities: { tools: {} },
    serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    instructions: MCP_INSTRUCTIONS,
  };
}

function readToolCall(params: unknown): { name: string; args: unknown } | { error: string } {
  if (!isRecord(params) || typeof params.name !== "string") {
    return { error: "tools/call requires name" };
  }
  return { name: params.name, args: params.arguments ?? {} };
}

export async function handleJsonRpcRequest(
  request: JsonRpcRequest,
  runtime: McpToolRuntime,
): Promise<JsonRpcResponse | null> {
  const isNotification = !("id" in request);
  const id = request.id ?? null;

  switch (request.method) {
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      if (isNotification) {
        return null;
      }
      return success(id, {});
    case "initialize": {
      if (isNotification) {
        return null;
      }
      const params = isRecord(request.params) ? request.params : {};
      return success(id, initializeResult(params.protocolVersion));
    }
    case "tools/list": {
      if (isNotification) {
        return null;
      }
      return success(id, { tools: listMcpTools() });
    }
    case "tools/call": {
      if (isNotification) {
        return null;
      }
      const parsed = readToolCall(request.params);
      if ("error" in parsed) {
        return failure(id, -32602, parsed.error);
      }
      try {
        const result = await callMcpTool(parsed.name, parsed.args, runtime);
        return success(id, result);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Tool failed";
        return success(id, {
          content: [{ type: "text", text: JSON.stringify({ error: message }) }],
          isError: true,
        });
      }
    }
    case "resources/list":
    case "resources/templates/list":
    case "prompts/list": {
      if (isNotification) {
        return null;
      }
      return success(id, { [request.method === "prompts/list" ? "prompts" : "resources"]: [] });
    }
    default:
      if (isNotification) {
        return null;
      }
      return failure(id, -32601, `Method not found: ${request.method}`);
  }
}

export async function handleJsonRpcMessages(
  messages: JsonRpcRequest[],
  runtime: McpToolRuntime,
): Promise<JsonRpcResponse[]> {
  const responses: JsonRpcResponse[] = [];
  for (const message of messages) {
    const response = await handleJsonRpcRequest(message, runtime);
    if (response) {
      responses.push(response);
    }
  }
  return responses;
}
