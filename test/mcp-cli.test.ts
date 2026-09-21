import { describe, expect, it } from "vitest";
import { CLI_HELP, parseCliArgs, runCli, type CliIo } from "../mcp/cli.ts";
import { localMcpRuntime } from "../mcp/local.ts";
import { serveStdio } from "../mcp/stdio.ts";
import type { JsonRpcResponse } from "../mcp/protocol.ts";

function memoryIo(): CliIo & { stdoutText: string; stderrText: string } {
  const io = {
    stdoutText: "",
    stderrText: "",
    stdout: {
      write: (chunk: string) => {
        io.stdoutText += chunk;
      },
    },
    stderr: {
      write: (chunk: string) => {
        io.stderrText += chunk;
      },
    },
  };
  return io;
}

describe("jevsume-mcp CLI", () => {
  it("reads the API key from a flag or TYPESAFE_API_KEY", () => {
    expect(parseCliArgs(["--api-key", "ts_live"], {}).apiKey).toBe("ts_live");
    expect(parseCliArgs([], { TYPESAFE_API_KEY: "from-env" }).apiKey).toBe("from-env");
    expect(parseCliArgs(["--mock"], {}).mock).toBe(true);
    expect(parseCliArgs(["--help"], {}).help).toBe(true);
    expect(CLI_HELP).toContain("--api-key");
  });

  it("exits 1 when the local server has no API key", async () => {
    const io = memoryIo();
    const code = await runCli([], {}, io);
    expect(code).toBe(1);
    expect(io.stderrText).toMatch(/TypeSafe API key/i);
  });

  it("prints help to stdout without starting the server", async () => {
    const io = memoryIo();
    const code = await runCli(["--help"], {}, io);
    expect(code).toBe(0);
    expect(io.stdoutText).toContain("local MCP server");
  });
});

describe("stdio MCP", () => {
  it("answers initialize over a line-delimited stream", async () => {
    async function* lines() {
      yield `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {} },
      })}\n`;
    }
    const messages: JsonRpcResponse[] = [];
    await serveStdio(localMcpRuntime({ mock: true }), lines(), (message) => {
      messages.push(message);
    });
    expect(messages[0]?.result).toEqual(expect.objectContaining({ serverInfo: expect.objectContaining({ name: "jevsume" }) }));
  });
});
