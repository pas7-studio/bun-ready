// File: src/cli.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReportFormat, Severity, FailOnPolicy } from "./types.js";
import { analyzeRepoOverall } from "./analyze.js";
import { renderMarkdown, renderDetailedReport } from "./report_md.js";
import { renderJson } from "./report_json.js";
import { mergeConfigWithOpts } from "./config.js";

const usage = (): string => {
  return [
    "bun-ready",
    "",
    "Usage:",
    "  bun-ready scan <path> [--format md|json] [--out <file>] [--no-install] [--no-test] [--verbose] [--detailed] [--scope root|packages|all] [--fail-on green|yellow|red]",
    "",
    "Options:",
    "  --format md|json       Output format (default: md)",
    "  --out <file>          Output file path (default: bun-ready.md or bun-ready.json)",
    "  --no-install           Skip bun install --dry-run",
    "  --no-test             Skip bun test",
    "  --verbose              Show detailed output",
    "  --detailed            Show detailed package usage report with file paths",
    "  --scope root|packages|all  Scan scope for monorepos (default: all)",
    "  --fail-on green|yellow|red  Fail policy (default: red)",
    "",
    "Exit codes:",
    "  0   green",
    "  2   yellow",
    "  3   red",
    "  1   invalid command"
  ].join("\n");
};

const parseArgs = (argv: string[]): { cmd: string; opts: { repoPath: string; format: ReportFormat; outFile: string | null; runInstall: boolean; runTest: boolean; verbose: boolean; detailed: boolean; scope: "root" | "packages" | "all"; failOn?: FailOnPolicy } } => {
  const args = argv.slice(2);
  const cmd = args[0] ?? "";
  if (cmd !== "scan") {
    return {
      cmd,
      opts: {
        repoPath: ".",
        format: "md",
        outFile: null,
        runInstall: true,
        runTest: true,
        verbose: false,
        detailed: false,
        scope: "all"
      }
    };
  }

  const repoPath = args[1] && !args[1].startsWith("-") ? args[1] : ".";
  let format: ReportFormat = "md";
  let outFile: string | null = null;
  let runInstall = true;
  let runTest = true;
  let verbose = false;
  let detailed = false;
  let scope: "root" | "packages" | "all" = "all";
  let failOn: FailOnPolicy | undefined;

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
    if (a === "--detailed") {
      detailed = true;
      continue;
    }
    if (a === "--scope") {
      const v = args[i + 1] ?? "";
      if (v === "root" || v === "packages" || v === "all") scope = v;
      i++;
      continue;
    }
    if (a === "--fail-on") {
      const v = args[i + 1] ?? "";
      if (v === "green" || v === "yellow" || v === "red") failOn = v;
      i++;
      continue;
    }
  }

  // Build opts object without undefined properties
  const baseOpts: any = {
    repoPath,
    format,
    outFile,
    runInstall,
    runTest,
    verbose,
    detailed,
    scope
  };
  
  if (failOn !== undefined) {
    baseOpts.failOn = failOn;
  }

  return {
    cmd,
    opts: baseOpts
  };
};

const exitCode = (sev: Severity, failOn: FailOnPolicy | undefined): number => {
  // Default behavior: green=0, yellow=2, red=3
  if (!failOn) {
    if (sev === "green") return 0;
    if (sev === "yellow") return 2;
    return 3;
  }

  // Custom failOn policy
  if (failOn === "green") {
    // Fail on anything not green
    if (sev === "green") return 0;
    return 3;
  }
  if (failOn === "yellow") {
    // Fail on red only
    if (sev === "red") return 3;
    return 0;
  }
  // failOn === "red" (same as default)
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

  // Load config
  const configOpts: any = {};
  if (opts.failOn !== undefined) {
    configOpts.failOn = opts.failOn;
  }
  if (opts.detailed !== undefined) {
    configOpts.detailed = opts.detailed;
  }
  const config = await mergeConfigWithOpts(null, configOpts);

  // Create scan options with new fields
  const scanOpts: any = {
    repoPath: opts.repoPath,
    format: opts.format,
    outFile: opts.outFile,
    runInstall: opts.runInstall,
    runTest: opts.runTest,
    verbose: opts.verbose,
    scope: opts.scope
  };
  
  if (opts.failOn !== undefined) {
    scanOpts.failOn = opts.failOn;
  }

  const res = await analyzeRepoOverall(scanOpts);

  // Check if any tests were skipped due to missing Bun
  if (res.install?.skipReason || res.test?.skipReason) {
    const skipWarnings: string[] = [];
    if (res.install?.skipReason) {
      skipWarnings.push(`Install check skipped: ${res.install.skipReason}`);
    }
    if (res.test?.skipReason) {
      skipWarnings.push(`Test run skipped: ${res.test.skipReason}`);
    }
    
    if (skipWarnings.length > 0) {
      process.stderr.write(`WARNING:\n${skipWarnings.map((w) => `  - ${w}`).join("\n")}\n`);
    }
  }

  const out = opts.format === "json" ? renderJson(res) : (opts.detailed ? renderDetailedReport(res) : renderMarkdown(res));
  const target = opts.outFile ?? (opts.format === "json" ? "bun-ready.json" : (opts.detailed ? "bun-ready-detailed.md" : "bun-ready.md"));

  const resolved = path.resolve(process.cwd(), target);
  await fs.writeFile(resolved, out, "utf8");

  process.stdout.write(`Wrote ${opts.format.toUpperCase()} report to ${resolved}\n`);
  process.exit(exitCode(res.severity, config?.failOn || opts.failOn));
};

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`bun-ready failed: ${msg}\n`);
  process.exit(3);
});
