import {
  handleJsonRpcMessages,
  parseJsonRpcMessages,
  type JsonRpcResponse,
} from "./protocol.ts";
import type { McpToolRuntime } from "./tools.ts";

export type StdioWriter = (message: JsonRpcResponse) => void;

function defaultWrite(message: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

export async function serveStdio(
  runtime: McpToolRuntime,
  input: AsyncIterable<string> = process.stdin,
  write: StdioWriter = defaultWrite,
): Promise<void> {
  for await (const chunk of splitLines(input)) {
    const line = chunk.trim();
    if (!line) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    const messages = parseJsonRpcMessages(parsed);
    if ("parseError" in messages) {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: messages.parseError } });
      continue;
    }
    const responses = await handleJsonRpcMessages(messages, runtime);
    for (const response of responses) {
      write(response);
    }
  }
}

async function* splitLines(input: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = "";
  for await (const piece of input) {
    buffer += piece;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      yield buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) {
    yield buffer;
  }
}
