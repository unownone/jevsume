#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const name = "jevsume-resume";
const outfile = resolve(root, `dist/${name}.zip`);

await mkdir(dirname(outfile), { recursive: true });
await rm(outfile, { force: true });

// Marketplaces expect the skill folder at the ZIP root: jevsume-resume/SKILL.md.
execFileSync("zip", ["-r", "-X", outfile, name, "-x", "*.DS_Store"], {
  cwd: resolve(root, "skills"),
  stdio: "inherit",
});

console.log(`Wrote ${outfile}`);
