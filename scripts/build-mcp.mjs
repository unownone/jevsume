#!/usr/bin/env node
import { chmod, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(root, "dist/jevsume-mcp.mjs");

let esbuild;
try {
  esbuild = await import("esbuild");
} catch {
  process.exit(0);
}

await mkdir(dirname(outfile), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["mcp/cli.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile,
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
});

await chmod(outfile, 0o755);
