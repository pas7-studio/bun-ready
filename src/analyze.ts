import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import type { OverallResult, PackageAnalysis, ScanOptions, Severity } from "./types.js";
import { exec } from "./spawn.js";
import { fileExists, normalizeRepoPath, readJsonFile, truncateLines } from "./util.js";
import { detectLockfileSignals, detectNativeAddonRiskV2, detectScriptRisks, detectRuntimeApiRisks, detectPmAssumptions, summarizeSeverity } from "./heuristics.js";
import { parseInstallLogs, getInstallSeverity } from "./bun_logs.js";
import { discoverWorkspaces, hasWorkspaces, type WorkspacePackage } from "./workspaces.js";
import { readConfig } from "./config.js";
import type { PackageJson } from "./internal_types.js";

/**
 * Read package.json and gather basic info about a package
 */
async function readRepoInfo(packagePath: string): Promise<{
  pkg: PackageJson;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  lockfiles: {
    bunLock: boolean;
    bunLockb: boolean;
    npmLock: boolean;
    yarnLock: boolean;
    pnpmLock: boolean;
  };
}> {
  const packageJsonPath = path.join(packagePath, "package.json");
  const pkg = await readJsonFile<PackageJson>(packageJsonPath);

  const scripts = pkg.scripts ?? {};
  const dependencies = pkg.dependencies ?? {};
  const devDependencies = pkg.devDependencies ?? {};
  const optionalDependencies = pkg.optionalDependencies ?? {};

  const lockfiles = {
    bunLock: await fileExists(path.join(packagePath, "bun.lock")),
    bunLockb: await fileExists(path.join(packagePath, "bun.lockb")),
    npmLock: await fileExists(path.join(packagePath, "package-lock.json")),
    yarnLock: await fileExists(path.join(packagePath, "yarn.lock")),
    pnpmLock: await fileExists(path.join(packagePath, "pnpm-lock.yaml"))
  };

  return { pkg, scripts, dependencies, devDependencies, optionalDependencies, lockfiles };
}

/**
 * Copy file if exists (for temp directory)
 */
async function copyIfExists(from: string, to: string): Promise<void> {
  try {
    await fs.copyFile(from, to);
  } catch {
    return;
  }
}

/**
 * Run bun install --dry-run in a temp directory
 */
async function runBunInstallDryRun(packagePath: string): Promise<{
  ok: boolean;
  summary: string;
  logs: string[];
  installAnalysis: ReturnType<typeof parseInstallLogs>;
  skipReason?: string;
}> {
  // Check if Bun is available first
  const { checkBunAvailable } = await import("./bun_check.js");
  const bunCheck = await checkBunAvailable();
  
  if (!bunCheck.available) {
    const skipReason = bunCheck.error!;
    return {
      ok: false,
      summary: `Skipped: ${skipReason}`,
      logs: [],
      installAnalysis: { blockedDeps: [], trustedDepsMentioned: [], notes: [] },
      skipReason
    };
  }

  const base = await fs.mkdtemp(path.join(os.tmpdir(), "bun-ready-"));
  const cleanup = async (): Promise<void> => {
    try {
      await fs.rm(base, { recursive: true, force: true });
    } catch {
      return;
    }
  };

  try {
    await copyIfExists(path.join(packagePath, "package.json"), path.join(base, "package.json"));
    await copyIfExists(path.join(packagePath, "bun.lock"), path.join(base, "bun.lock"));
    await copyIfExists(path.join(packagePath, "bun.lockb"), path.join(base, "bun.lockb"));
    await copyIfExists(path.join(packagePath, "package-lock.json"), path.join(base, "package-lock.json"));
    await copyIfExists(path.join(packagePath, "yarn.lock"), path.join(base, "yarn.lock"));
    await copyIfExists(path.join(packagePath, "pnpm-lock.yaml"), path.join(base, "pnpm-lock.yaml"));

    const res = await exec("bun", ["install", "--dry-run"], base);
    const combined = [...(res.stdout ? res.stdout.split("\n") : []), ...(res.stderr ? res.stderr.split("\n") : [])].filter((l) => l.trim().length > 0);
    const logs = truncateLines(combined, 60);
    const installAnalysis = parseInstallLogs(logs);

    return res.code === 0
      ? { ok: true, summary: "bun install --dry-run succeeded", logs, installAnalysis }
      : { ok: false, summary: `bun install --dry-run failed (exit ${res.code})`, logs, installAnalysis };
  } finally {
    await cleanup();
  }
}

/**
 * Check if test script uses bun test
 */
function shouldRunBunTest(scripts: Record<string, string>): boolean {
  const t = scripts["test"];
  if (!t) return false;
  return t.toLowerCase().includes("bun test") || t.toLowerCase().trim() === "bun test";
}

/**
 * Run bun test
 */
async function runBunTest(packagePath: string): Promise<{ ok: boolean; summary: string; logs: string[]; skipReason?: string }> {
  // Check if Bun is available first
  const { checkBunAvailable } = await import("./bun_check.js");
  const bunCheck = await checkBunAvailable();
  
  if (!bunCheck.available) {
    const skipReason = bunCheck.error!;
    return {
      ok: false,
      summary: `Skipped: ${skipReason}`,
      logs: [],
      skipReason
    };
  }

  const res = await exec("bun", ["test"], packagePath);
  const combined = [...(res.stdout ? res.stdout.split("\n") : []), ...(res.stderr ? res.stderr.split("\n") : [])].filter((l) => l.trim().length > 0);
  const logs = truncateLines(combined, 120);
  return res.code === 0
    ? { ok: true, summary: "bun test succeeded", logs }
    : { ok: false, summary: `bun test failed (exit ${res.code})`, logs };
}

/**
 * Filter findings based on config
 */
function filterFindings(findings: import("./types.js").Finding[], config: import("./types.js").BunReadyConfig | null): import("./types.js").Finding[] {
  const ignoreList = config?.ignoreFindings;
  if (!ignoreList || ignoreList.length === 0) {
    return findings;
  }

  return findings.filter((f) => !ignoreList.includes(f.id));
}

/**
 * Analyze a single package
 */
export async function analyzeSinglePackage(
  packagePath: string,
  opts: ScanOptions,
  config: import("./types.js").BunReadyConfig | null,
  pkgName?: string
): Promise<PackageAnalysis> {
  const info = await readRepoInfo(packagePath);
  const name = pkgName || info.pkg.name || path.basename(packagePath);

  // Run all heuristics
  let findings = [
    ...detectLockfileSignals({ packageJsonPath: packagePath, lockfiles: info.lockfiles, scripts: info.scripts, dependencies: info.dependencies, devDependencies: info.devDependencies, optionalDependencies: info.optionalDependencies, hasWorkspaces: false, packageJson: info.pkg }),
    ...detectScriptRisks({ packageJsonPath: packagePath, lockfiles: info.lockfiles, scripts: info.scripts, dependencies: info.dependencies, devDependencies: info.devDependencies, optionalDependencies: info.optionalDependencies, hasWorkspaces: false, packageJson: info.pkg }),
    ...detectNativeAddonRiskV2({ packageJsonPath: packagePath, lockfiles: info.lockfiles, scripts: info.scripts, dependencies: info.dependencies, devDependencies: info.devDependencies, optionalDependencies: info.optionalDependencies, hasWorkspaces: false, packageJson: info.pkg }, config || undefined),
    ...detectRuntimeApiRisks({ packageJsonPath: packagePath, lockfiles: info.lockfiles, scripts: info.scripts, dependencies: info.dependencies, devDependencies: info.devDependencies, optionalDependencies: info.optionalDependencies, hasWorkspaces: false, packageJson: info.pkg }),
    ...detectPmAssumptions({ packageJsonPath: packagePath, lockfiles: info.lockfiles, scripts: info.scripts, dependencies: info.dependencies, devDependencies: info.devDependencies, optionalDependencies: info.optionalDependencies, hasWorkspaces: false, packageJson: info.pkg })
  ];

  // Filter findings based on config
  findings = filterFindings(findings, config);

  // Run install (if requested)
  let install: PackageAnalysis["install"] = null;
  let installOk: boolean | null = null;
  if (opts.runInstall) {
    const installResult = await runBunInstallDryRun(packagePath);
    install = {
      ok: installResult.ok,
      summary: installResult.summary,
      logs: installResult.logs,
      ...(installResult.skipReason !== undefined ? { skipReason: installResult.skipReason } : {})
    };
    installOk = installResult.ok;

    // Add install findings
    if (installResult.installAnalysis.blockedDeps.length > 0) {
      findings.push({
        id: "install.blocked_scripts",
        title: "Lifecycle scripts blocked by Bun",
        severity: "red",
        details: installResult.installAnalysis.blockedDeps,
        hints: [
          "Bun blocks lifecycle scripts of dependencies unless they are in trustedDependencies.",
          "Add the blocked packages to trustedDependencies in root package.json.",
          "Review if these packages are necessary or can be replaced with alternatives."
        ]
      });
    }

    if (installResult.installAnalysis.trustedDepsMentioned.length > 0) {
      findings.push({
        id: "install.trusted_deps",
        title: "Trusted dependencies mentioned in install output",
        severity: "yellow",
        details: installResult.installAnalysis.trustedDepsMentioned,
        hints: [
          "Review the trustedDependencies configuration in your package.json.",
          "Consider adding packages to trustedDependencies if you trust them."
        ]
      });
    }
  }

  // Run test (if requested)
  let test: PackageAnalysis["test"] = null;
  let testOk: boolean | null = null;
  if (opts.runTest && shouldRunBunTest(info.scripts)) {
    const testResult = await runBunTest(packagePath);
    test = {
      ok: testResult.ok,
      summary: testResult.summary,
      logs: testResult.logs,
      ...(testResult.skipReason !== undefined ? { skipReason: testResult.skipReason } : {})
    };
    testOk = testResult.ok;
  }

  // Calculate severity
  const severity = summarizeSeverity(findings, installOk, testOk);

  // Build summary lines
  const summaryLines: string[] = [];
  summaryLines.push(`Lockfiles: ${info.lockfiles.bunLock || info.lockfiles.bunLockb ? "bun" : "non-bun or missing"}`);
  summaryLines.push(`Lifecycle scripts: ${Object.keys(info.scripts).some((k) => ["postinstall", "prepare", "preinstall", "install"].includes(k)) ? "present" : "none"}`);
  summaryLines.push(`Native addon risk: ${findings.some((f) => f.id === "deps.native_addons") ? "yes" : "no"}`);
  summaryLines.push(`bun install dry-run: ${install ? (install.ok ? "ok" : "failed") : "skipped"}`);
  summaryLines.push(`bun test: ${test ? (test.ok ? "ok" : "failed") : "skipped"}`);

  return {
    name,
    path: packagePath,
    severity,
    summaryLines,
    findings,
    install,
    test,
    scripts: info.scripts,
    dependencies: info.dependencies,
    devDependencies: info.devDependencies,
    optionalDependencies: info.optionalDependencies,
    lockfiles: info.lockfiles
  };
}

/**
 * Aggregate severity from multiple packages
 */
function aggregateSeverity(packages: PackageAnalysis[], overallSeverity: Severity): Severity {
  if (overallSeverity === "red") return "red";
  if (overallSeverity === "yellow") return "yellow";
  
  for (const pkg of packages) {
    if (pkg.severity === "red") return "red";
  }
  
  for (const pkg of packages) {
    if (pkg.severity === "yellow") return "yellow";
  }
  
  return "green";
}

/**
 * Analyze the entire repository (root + workspaces)
 */
export async function analyzeRepoOverall(opts: ScanOptions): Promise<OverallResult> {
  const repoPath = normalizeRepoPath(opts.repoPath);
  const packageJsonPath = path.join(repoPath, "package.json");
  const hasPkg = await fileExists(packageJsonPath);

  // Load config
  const config = await readConfig(repoPath);

  // Check for missing package.json
  if (!hasPkg) {
    return {
      version: "0.2",
      severity: "red",
      summaryLines: ["package.json not found"],
      findings: [
        {
          id: "repo.no_package_json",
          title: "Missing package.json",
          severity: "red",
          details: [`Expected at: ${packageJsonPath.replace(/\\/g, "/")}`],
          hints: ["Run bun-ready in a Node.js project root (where package.json exists)."]
        }
      ],
      install: null,
      test: null,
      repo: {
        packageJsonPath,
        hasWorkspaces: false,
        rootPackage: { name: "", version: "" },
        lockfiles: { bunLock: false, bunLockb: false, npmLock: false, yarnLock: false, pnpmLock: false },
        scripts: {},
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {}
      },
      packages: [],
      config
    };
  }

  // Read root package
  const rootInfo = await readRepoInfo(repoPath);
  const rootHasWorkspaces = await hasWorkspaces(repoPath);
  const workspacePackages: WorkspacePackage[] = [];

  // Discover workspaces
  if (rootHasWorkspaces) {
    workspacePackages.push(...await discoverWorkspaces(repoPath));
  }

  // Filter packages based on config
  let packagesToAnalyze: string[] = [];
  let packagesToReport: string[] = [];

  if (opts.scope === "root") {
    // Only root package
    packagesToAnalyze = [repoPath];
    packagesToReport = [repoPath];
  } else if (opts.scope === "packages") {
    // Only workspace packages
    packagesToAnalyze = workspacePackages.map((wp) => wp.path);
    packagesToReport = workspacePackages.map((wp) => wp.path);
  } else {
    // All: root + packages
    packagesToAnalyze = [repoPath, ...workspacePackages.map((wp) => wp.path)];
    packagesToReport = [repoPath, ...workspacePackages.map((wp) => wp.path)];
  }

  // Filter out ignored packages
  const ignorePackages = config?.ignorePackages;
  if (ignorePackages && ignorePackages.length > 0) {
    packagesToAnalyze = packagesToAnalyze.filter((p) => {
      return !ignorePackages.some((ignore) => p.includes(ignore));
    });
    packagesToReport = packagesToReport.filter((p) => {
      return !ignorePackages.some((ignore) => p.includes(ignore));
    });
  }

  // Analyze all packages
  const packages: PackageAnalysis[] = [];
  for (const packagePath of packagesToAnalyze) {
    const wp = workspacePackages.find((w) => w.path === packagePath);
    const analysis = await analyzeSinglePackage(packagePath, opts, config, wp?.name);
    packages.push(analysis);
  }

  // Get root package analysis (for overall findings)
  const rootAnalysis = packages.find((p) => p.path === repoPath);

  // Calculate overall severity
  let overallSeverity: Severity = "green";
  
  // Consider root severity
  if (rootAnalysis) {
    overallSeverity = rootAnalysis.severity;
  }
  
  // Aggregate with package severities
  overallSeverity = aggregateSeverity(packages, overallSeverity);

  // Build overall findings (only from root package)
  const overallFindings: import("./types.js").Finding[] = rootAnalysis ? rootAnalysis.findings : [];

  // Build overall summary lines
  const overallSummaryLines: string[] = [];
  overallSummaryLines.push(`Total packages analyzed: ${packages.length}`);
  overallSummaryLines.push(`Workspaces detected: ${rootHasWorkspaces ? "yes" : "no"}`);
  if (rootHasWorkspaces) {
    overallSummaryLines.push(`Workspace packages: ${workspacePackages.length}`);
  }
  overallSummaryLines.push(`Root package severity: ${rootAnalysis ? rootAnalysis.severity : "unknown"}`);
  overallSummaryLines.push(`Overall severity: ${overallSeverity}`);

  // Return overall result
  return {
    version: "0.2",
    severity: overallSeverity,
    summaryLines: overallSummaryLines,
    findings: overallFindings,
    install: rootAnalysis ? rootAnalysis.install : null,
    test: rootAnalysis ? rootAnalysis.test : null,
    repo: {
      packageJsonPath,
      hasWorkspaces: rootHasWorkspaces,
      rootPackage: {
        name: rootInfo.pkg.name || "",
        version: rootInfo.pkg.version || ""
      },
      lockfiles: rootInfo.lockfiles,
      scripts: rootInfo.scripts,
      dependencies: rootInfo.dependencies,
      devDependencies: rootInfo.devDependencies,
      optionalDependencies: rootInfo.optionalDependencies
    },
    packages,
    config
  };
}

/**
 * Legacy function for backwards compatibility (v0.1)
 * @deprecated Use analyzeRepoOverall instead
 */
export async function analyzeRepo(opts: ScanOptions): Promise<OverallResult> {
  return analyzeRepoOverall(opts);
}
