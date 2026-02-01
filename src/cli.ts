// File: src/cli.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ReportFormat, Severity, FailOnPolicy, ScanOptions, CIOptions, PolicyConfig, PackageAnalysis, ChangedOnlyOptions } from "./types.js";
import { analyzeRepoOverall } from "./analyze.js";
import { renderMarkdown, renderDetailedReport } from "./report_md.js";
import { renderJson } from "./report_json.js";
import { mergeConfigWithOpts } from "./config.js";
import { renderSarif } from "./sarif.js";
import { generateCISummary, formatCISummaryText, formatGitHubJobSummary, calculateExitCode } from "./ci_summary.js";
import { parseRuleArgs, mergePolicyConfigs, applyPolicy } from "./policy.js";
import { loadBaseline, saveBaseline, compareFindings } from "./baseline.js";
import { detectChangedPackages, mapPathsToPackages } from "./changed_only.js";

const usage = (): string => {
  return [
    "bun-ready",
    "",
    "Usage:",
    "  bun-ready scan <path> [--format md|json|sarif] [--out <file>] [--no-install] [--no-test] [--verbose] [--detailed] [--scope root|packages|all] [--fail-on green|yellow|red] [--ci] [--output-dir <dir>] [--rule <id>=<action>] [--max-warnings <n>] [--baseline <file>] [--update-baseline] [--changed-only] [--since <ref>]",
    "",
    "Options:",
    "  --format md|json|sarif       Output format (default: md)",
    "  --out <file>          Output file path (default: bun-ready.md or bun-ready.json)",
    "  --no-install           Skip bun install --dry-run",
    "  --no-test             Skip bun test",
    "  --verbose              Show detailed output",
    "  --detailed            Show detailed package usage report with file paths",
    "  --scope root|packages|all  Scan scope for monorepos (default: all)",
    "  --fail-on green|yellow|red  Fail policy (default: red)",
    "  --ci                  Run in CI mode (stable output, minimal noise)",
    "  --output-dir <dir>    Output directory for all artifacts (in CI mode)",
    "  --rule <id>=<action>  Apply policy rule (e.g., --rule deps.native_addons=fail)",
    "  --max-warnings <n>    Maximum warnings allowed (threshold)",
    "  --baseline <file>      Baseline file for regression detection",
    "  --update-baseline      Update baseline file after scan",
    "  --changed-only         Scan only changed packages (monorepos)",
    "  --since <ref>         Git ref for changed packages (e.g., main, HEAD~1)",
    "",
    "Exit codes:",
    "  0   green",
    "  2   yellow",
    "  3   red",
    "  1   invalid command"
  ].join("\n");
};

const parseArgs = (argv: string[]): { cmd: string; opts: { repoPath: string; format: ReportFormat; outFile: string | null; runInstall: boolean; runTest: boolean; verbose: boolean; detailed: boolean; scope: "root" | "packages" | "all"; failOn?: FailOnPolicy; ci?: CIOptions; policy?: PolicyConfig; baseline?: { file: string; update?: boolean }; changedOnly?: ChangedOnlyOptions } } => {
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
  let ci: CIOptions | undefined;
  let outputDir: string | undefined;
  let ruleArgs: string[] = [];
  let maxWarnings: number | undefined;
  let baseline: { file: string; update?: boolean } | undefined;
  let changedOnly: ChangedOnlyOptions | undefined;

  for (let i = 2; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--format") {
      const v = args[i + 1] ?? "";
      if (v === "md" || v === "json" || v === "sarif") format = v;
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
    if (a === "--ci") {
      ci = { mode: true };
      continue;
    }
    if (a === "--output-dir") {
      outputDir = args[i + 1];
      i++;
      continue;
    }
    if (a === "--rule") {
      ruleArgs.push(args[i + 1] ?? "");
      i++;
      continue;
    }
    if (a === "--max-warnings") {
      const v = args[i + 1] ?? "";
      const num = parseInt(v, 10);
      if (!isNaN(num) && num >= 0) {
        maxWarnings = num;
      }
      i++;
      continue;
    }
    if (a === "--baseline") {
      baseline = { file: args[i + 1] ?? "" };
      i++;
      continue;
    }
    if (a === "--update-baseline") {
      if (!baseline) {
        baseline = { file: "", update: true };
      } else {
        baseline.update = true;
      }
      continue;
    }
    if (a === "--changed-only") {
      if (!changedOnly) {
        changedOnly = { enabled: true };
      } else {
        changedOnly.enabled = true;
      }
      continue;
    }
    if (a === "--since") {
      if (!changedOnly) {
        changedOnly = { enabled: true, sinceRef: args[i + 1] ?? "" };
      } else {
        changedOnly.sinceRef = args[i + 1] ?? "";
      }
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

  if (ci !== undefined) {
    baseOpts.ci = ci;
  }

  if (outputDir !== undefined) {
    if (!baseOpts.ci) {
      baseOpts.ci = { mode: true };
    }
    baseOpts.ci.outputDir = outputDir;
  }

  // Build policy config
  if (ruleArgs.length > 0 || maxWarnings !== undefined) {
    const policy: PolicyConfig = {};
    if (ruleArgs.length > 0) {
      policy.rules = parseRuleArgs(ruleArgs);
    }
    if (maxWarnings !== undefined) {
      policy.thresholds = { maxWarnings };
    }
    baseOpts.policy = policy;
  }

  // Add baseline if specified
  if (baseline !== undefined && (baseline.file || baseline.update)) {
    baseOpts.baseline = baseline;
  }

  // Add changed-only if specified
  if (changedOnly !== undefined && changedOnly.enabled) {
    baseOpts.changedOnly = changedOnly;
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

  // Merge policy config with CLI opts
  const mergedPolicy = mergePolicyConfigs(opts.policy, config?.rules ? { rules: config.rules } : undefined);

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

  if (opts.ci !== undefined) {
    scanOpts.ci = opts.ci;
  }

  if (mergedPolicy !== undefined) {
    scanOpts.policy = mergedPolicy;
  }

  const res = await analyzeRepoOverall(scanOpts);

  // Detect changed packages if --changed-only is specified (after scanning all packages)
  let changedPackages: string[] | undefined;
  if (opts.changedOnly?.enabled && opts.changedOnly?.sinceRef) {
    try {
      const detectedPaths = await detectChangedPackages(
        opts.repoPath,
        opts.changedOnly.sinceRef,
        res.packages?.map((p) => ({ path: p.path, packageJsonPath: p.path, name: p.name }))
      );

      // Map paths to package paths
      if (res.packages) {
        changedPackages = mapPathsToPackages(detectedPaths, res.packages);
      }
    } catch (error) {
      process.stderr.write(`Failed to detect changed packages: ${error instanceof Error ? error.message : String(error)}\n`);
      // Continue with all packages scanned
    }
  }

  // Load baseline if specified
  let baselineData: any = null;
  if (opts.baseline?.file) {
    try {
      baselineData = await loadBaseline(opts.baseline.file);
    } catch (error) {
      process.stderr.write(`Failed to load baseline: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  }

  // Apply policy to findings if configured
  let finalResult = res;
  if (mergedPolicy) {
    const policyResult = applyPolicy(res.findings, mergedPolicy);
    finalResult = {
      ...res,
      findings: policyResult.modifiedFindings,
      policyApplied: policyResult.summary
    };
  }

  // Convert findings to fingerprints for baseline comparison
  const { createFindingFingerprint, calculateBaselineMetrics } = await import("./baseline.js");
  const packages = finalResult.packages || [];
  const allFindings = [...finalResult.findings];
  for (const pkg of packages) {
    for (const finding of pkg.findings) {
      allFindings.push(finding);
    }
  }
  const currentFingerprints = allFindings.map((f) => createFindingFingerprint(f));

  // Compare with baseline if loaded
  if (baselineData) {
    const comparison = compareFindings(baselineData.findings, currentFingerprints);
    finalResult = {
      ...finalResult,
      baselineComparison: comparison
    };

    // Update baseline if requested
    if (opts.baseline?.update) {
      const updatedBaseline = {
        ...baselineData,
        timestamp: new Date().toISOString(),
        findings: currentFingerprints
      };
      await saveBaseline(updatedBaseline, opts.baseline.file || "");
    }
  }

  // Add changed packages to result
  if (changedPackages) {
    (finalResult as any).changedPackages = changedPackages;
  }

  // Check if any tests were skipped due to missing Bun
  if (finalResult.install?.skipReason || finalResult.test?.skipReason) {
    const skipWarnings: string[] = [];
    if (finalResult.install?.skipReason) {
      skipWarnings.push(`Install check skipped: ${finalResult.install.skipReason}`);
    }
    if (finalResult.test?.skipReason) {
      skipWarnings.push(`Test run skipped: ${finalResult.test.skipReason}`);
    }

    if (skipWarnings.length > 0) {
      process.stderr.write(`WARNING:\n${skipWarnings.map((w) => `  - ${w}`).join("\n")}\n`);
    }
  }

  // Generate output based on format
  let out = "";
  if (opts.format === "sarif") {
    out = JSON.stringify(renderSarif(finalResult), null, 2);
  } else if (opts.format === "json") {
    out = renderJson(finalResult);
  } else {
    out = opts.detailed ? renderDetailedReport(finalResult) : renderMarkdown(finalResult);
  }

  // Determine output file and directory
  let target = opts.outFile;
  let outputDir = opts.ci?.outputDir;

  if (!target) {
    if (opts.format === "sarif") {
      target = "bun-ready.sarif.json";
    } else if (opts.format === "json") {
      target = "bun-ready.json";
    } else if (opts.detailed) {
      target = "bun-ready-detailed.md";
    } else {
      target = "bun-ready.md";
    }
  }

  // Resolve output path
  const resolved = outputDir
    ? path.resolve(process.cwd(), outputDir, target)
    : path.resolve(process.cwd(), target);

  // Ensure output directory exists if specified
  if (outputDir) {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
  }

  await fs.writeFile(resolved, out, "utf8");

  // In CI mode, generate and display summary
  if (opts.ci?.mode) {
    const ciSummary = generateCISummary(finalResult, config?.failOn || opts.failOn);
    const summaryText = formatCISummaryText(ciSummary);
    process.stdout.write(`\n${summaryText}\n`);

    // Write GitHub job summary if in GitHub Actions
    if (process.env.GITHUB_STEP_SUMMARY) {
      const githubSummary = formatGitHubJobSummary(ciSummary);
      await fs.writeFile(process.env.GITHUB_STEP_SUMMARY, githubSummary, "utf8");
    }
  } else {
    process.stdout.write(`Wrote ${opts.format.toUpperCase()} report to ${resolved}\n`);
  }

  // Calculate exit code
  const exitCodeValue = calculateExitCode(finalResult.severity, config?.failOn || opts.failOn);
  process.exit(exitCodeValue);
};

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`bun-ready failed: ${msg}\n`);
  process.exit(3);
});
