import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./compact.ts";
import { localMcpRuntime } from "./local.ts";
import { serveStdio } from "./stdio.ts";

export { localMcpRuntime } from "./local.ts";

export const CLI_HELP = `jevsume-mcp — local MCP server for compact Jev resume review

Usage:
  jevsume-mcp --api-key $TYPESAFE_API_KEY
  TYPESAFE_API_KEY=... jevsume-mcp

Options:
  --api-key <key>   TypeSafe API key (required unless --mock)
  --base-url <url>  TypeSafe API host (default https://api.typesafe.ai)
  --model <id>      Model id (default jev-latest)
  --mock            Deterministic mock provider (tests/dev only)
  --help            Show this help

Examples:
  TYPESAFE_API_KEY=ts_... jevsume-mcp
  npx -y github:unownone/jevsume -- --api-key $TYPESAFE_API_KEY

MCP client config (stdio):
  command: npx
  args: ["-y", "github:unownone/jevsume", "--api-key", "<TYPESAFE_API_KEY>"]

Hosted (no key): POST /mcp on the jevsume Worker.
Skill: skills/jevsume-resume/SKILL.md
`;

export type CliOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  mock: boolean;
  help: boolean;
};

export type EnvMap = Record<string, string | undefined>;

export type CliIo = {
  stdout: { write: (chunk: string) => void };
  stderr: { write: (chunk: string) => void };
};

function defaultIo(): CliIo {
  return {
    stdout: {
      write: (chunk) => {
        process.stdout.write(chunk);
      },
    },
    stderr: {
      write: (chunk) => {
        process.stderr.write(chunk);
      },
    },
  };
}

function readFlag(argv: string[], name: string): { value?: string; rest: string[] } {
  const index = argv.findIndex((item) => item === name || item.startsWith(`${name}=`));
  if (index === -1) {
    return { rest: argv };
  }
  const token = argv[index];
  if (token && token.startsWith(`${name}=`)) {
    return { value: token.slice(name.length + 1), rest: [...argv.slice(0, index), ...argv.slice(index + 1)] };
  }
  const next = argv[index + 1];
  if (!next || next.startsWith("-")) {
    return { value: "", rest: [...argv.slice(0, index), ...argv.slice(index + 1)] };
  }
  return { value: next, rest: [...argv.slice(0, index), ...argv.slice(index + 2)] };
}

export function parseCliArgs(argv: string[], env: EnvMap): CliOptions {
  let rest = argv.filter((item) => item !== "--");
  const help = rest.includes("--help") || rest.includes("-h");
  rest = rest.filter((item) => item !== "--help" && item !== "-h");
  const mock = rest.includes("--mock");
  rest = rest.filter((item) => item !== "--mock");
  const keyFlag = readFlag(rest, "--api-key");
  rest = keyFlag.rest;
  const baseFlag = readFlag(rest, "--base-url");
  rest = baseFlag.rest;
  const modelFlag = readFlag(rest, "--model");
  rest = modelFlag.rest;
  if (rest.length > 0) {
    throw new Error(`Unknown argument: ${rest[0]}\n${CLI_HELP}`);
  }
  return {
    apiKey: keyFlag.value || env.TYPESAFE_API_KEY?.trim() || undefined,
    baseUrl: baseFlag.value || env.TYPESAFE_BASE_URL?.trim() || undefined,
    model: modelFlag.value || env.TYPESAFE_MODEL?.trim() || undefined,
    mock,
    help,
  };
}

export async function runCli(argv: string[], env: EnvMap, io: CliIo = defaultIo()): Promise<number> {
  let options: CliOptions;
  try {
    options = parseCliArgs(argv, env);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    io.stderr.write(`${message}\n`);
    return 1;
  }
  if (options.help) {
    io.stdout.write(CLI_HELP);
    return 0;
  }
  if (!options.mock && !options.apiKey) {
    io.stderr.write("Error: TypeSafe API key required for the local MCP server.\n");
    io.stderr.write("  jevsume-mcp --api-key $TYPESAFE_API_KEY\n");
    io.stderr.write("  TYPESAFE_API_KEY=... jevsume-mcp\n");
    return 1;
  }
  const runtime = localMcpRuntime(options);
  io.stderr.write(`${MCP_SERVER_NAME} ${MCP_SERVER_VERSION} stdio MCP ready\n`);
  await serveStdio(runtime);
  return 0;
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("jevsume-mcp.mjs");

if (isMain) {
  void runCli(process.argv.slice(2), process.env).then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}
