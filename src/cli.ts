#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReportFormat, ScanOptions, Severity } from "./types.js";
import { analyzeRepo } from "./analyze.js";
import { renderMarkdown } from "./report_md.js";
import { renderJson } from "./report_json.js";

const usage = (): string => {
  return [
    "bun-ready",
    "",
    "Usage:",
    "  bun-ready scan <path> [--format md|json] [--out <file>] [--no-install] [--no-test] [--verbose]",
    "",
    "Exit codes:",
    "  0 green, 2 yellow, 3 red"
  ].join("\n");
};

const parseArgs = (argv: string[]): { cmd: string; opts: ScanOptions } => {
  const args = argv.slice(2);
  const cmd = args[0] ?? "";
  if (cmd !== "scan") {
    return {
      cmd,
      opts: { repoPath: ".", format: "md", outFile: null, runInstall: true, runTest: true, verbose: false }
    };
  }

  const repoPath = args[1] && !args[1].startsWith("-") ? args[1] : ".";
  let format: ReportFormat = "md";
  let outFile: string | null = null;
  let runInstall = true;
  let runTest = true;
  let verbose = false;

  for (let i = 2; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--format") {
      const v = args[i + 1] ?? "";
      if (v === "md" || v === "json") format = v;
      i++;
      continue;
    }
    if (a === "--out") {
      outFile = args[i + 1] ?? null;
      i++;
      continue;
    }
    if (a === "--no-install") {
      runInstall = false;
      continue;
    }
    if (a === "--no-test") {
      runTest = false;
      continue;
    }
    if (a === "--verbose") {
      verbose = true;
      continue;
    }
  }

  return { cmd, opts: { repoPath, format, outFile, runInstall, runTest, verbose } };
};

const exitCode = (sev: Severity): number => {
  if (sev === "green") return 0;
  if (sev === "yellow") return 2;
  return 3;
};

const main = async (): Promise<void> => {
  const { cmd, opts } = parseArgs(process.argv);

  if (cmd !== "scan") {
    process.stderr.write(usage() + "\n");
    process.exit(1);
  }

  const res = await analyzeRepo(opts);

  const out = opts.format === "json" ? renderJson(res) : renderMarkdown(res);
  const target = opts.outFile ?? (opts.format === "json" ? "bun-ready.json" : "bun-ready.md");

  const resolved = path.resolve(process.cwd(), target);
  await fs.writeFile(resolved, out, "utf8");

  process.stdout.write(`Wrote ${opts.format.toUpperCase()} report to ${resolved}\n`);
  process.exit(exitCode(res.severity));
};

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`bun-ready failed: ${msg}\n`);
  process.exit(3);
});
