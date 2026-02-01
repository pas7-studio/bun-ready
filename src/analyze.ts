import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import type { AnalysisResult, RepoInfo, ScanOptions } from "./types.js";
import { exec } from "./spawn.js";
import { fileExists, normalizeRepoPath, readJsonFile, truncateLines } from "./util.js";
import { detectLockfileSignals, detectNativeAddonRisk, detectScriptRisks, summarizeSeverity } from "./heuristics.js";

type PackageJson = {
  name?: string;
  version?: string;
  workspaces?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const readRepoInfo = async (repoPath: string): Promise<RepoInfo> => {
  const packageJsonPath = path.join(repoPath, "package.json");
  const pkg = await readJsonFile<PackageJson>(packageJsonPath);

  const scripts = pkg.scripts ?? {};
  const dependencies = pkg.dependencies ?? {};
  const devDependencies = pkg.devDependencies ?? {};
  const optionalDependencies = pkg.optionalDependencies ?? {};
  const hasWorkspaces = Boolean(pkg.workspaces);

  const lockfiles = {
    bunLock: await fileExists(path.join(repoPath, "bun.lock")),
    bunLockb: await fileExists(path.join(repoPath, "bun.lockb")),
    npmLock: await fileExists(path.join(repoPath, "package-lock.json")),
    yarnLock: await fileExists(path.join(repoPath, "yarn.lock")),
    pnpmLock: await fileExists(path.join(repoPath, "pnpm-lock.yaml"))
  };

  return { packageJsonPath, lockfiles, scripts, dependencies, devDependencies, optionalDependencies, hasWorkspaces };
};

const copyIfExists = async (from: string, to: string): Promise<void> => {
  try {
    await fs.copyFile(from, to);
  } catch {
    return;
  }
};

const runBunInstallDryRun = async (repoPath: string): Promise<{ ok: boolean; summary: string; logs: string[] }> => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "bun-ready-"));
  const cleanup = async (): Promise<void> => {
    try {
      await fs.rm(base, { recursive: true, force: true });
    } catch {
      return;
    }
  };

  try {
    await copyIfExists(path.join(repoPath, "package.json"), path.join(base, "package.json"));
    await copyIfExists(path.join(repoPath, "bun.lock"), path.join(base, "bun.lock"));
    await copyIfExists(path.join(repoPath, "bun.lockb"), path.join(base, "bun.lockb"));
    await copyIfExists(path.join(repoPath, "package-lock.json"), path.join(base, "package-lock.json"));
    await copyIfExists(path.join(repoPath, "yarn.lock"), path.join(base, "yarn.lock"));
    await copyIfExists(path.join(repoPath, "pnpm-lock.yaml"), path.join(base, "pnpm-lock.yaml"));

    const res = await exec("bun", ["install", "--dry-run"], base);
    const combined = [...(res.stdout ? res.stdout.split("\n") : []), ...(res.stderr ? res.stderr.split("\n") : [])].filter((l) => l.trim().length > 0);
    const logs = truncateLines(combined, 60);

    return res.code === 0
      ? { ok: true, summary: "bun install --dry-run succeeded", logs }
      : { ok: false, summary: `bun install --dry-run failed (exit ${res.code})`, logs };
  } finally {
    await cleanup();
  }
};

const shouldRunBunTest = (repo: RepoInfo): boolean => {
  const t = repo.scripts["test"];
  if (!t) return false;
  return t.toLowerCase().includes("bun test") || t.toLowerCase().trim() === "bun test";
};

const runBunTest = async (repoPath: string): Promise<{ ok: boolean; summary: string; logs: string[] }> => {
  const res = await exec("bun", ["test"], repoPath);
  const combined = [...(res.stdout ? res.stdout.split("\n") : []), ...(res.stderr ? res.stderr.split("\n") : [])].filter((l) => l.trim().length > 0);
  const logs = truncateLines(combined, 120);
  return res.code === 0
    ? { ok: true, summary: "bun test succeeded", logs }
    : { ok: false, summary: `bun test failed (exit ${res.code})`, logs };
};

export const analyzeRepo = async (opts: ScanOptions): Promise<AnalysisResult> => {
  const repoPath = normalizeRepoPath(opts.repoPath);
  const packageJsonPath = path.join(repoPath, "package.json");
  const hasPkg = await fileExists(packageJsonPath);

  if (!hasPkg) {
    return {
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
        lockfiles: { bunLock: false, bunLockb: false, npmLock: false, yarnLock: false, pnpmLock: false },
        scripts: {},
        dependencies: {},
        devDependencies: {},
        optionalDependencies: {},
        hasWorkspaces: false
      }
    };
  }

  const repo = await readRepoInfo(repoPath);

  const findings = [
    ...detectLockfileSignals(repo),
    ...detectScriptRisks(repo),
    ...detectNativeAddonRisk(repo)
  ];

  const install = opts.runInstall ? await runBunInstallDryRun(repoPath) : null;

  const allowTest = opts.runTest && shouldRunBunTest(repo);
  const test = allowTest ? await runBunTest(repoPath) : null;

  const installOk = install ? install.ok : null;
  const testOk = test ? test.ok : null;

  const severity = summarizeSeverity(findings, installOk, testOk);

  const summaryLines: string[] = [];
  summaryLines.push(`Lockfiles: ${repo.lockfiles.bunLock || repo.lockfiles.bunLockb ? "bun" : "non-bun or missing"}`);
  summaryLines.push(`Lifecycle scripts: ${Object.keys(repo.scripts).some((k) => ["postinstall", "prepare", "preinstall", "install"].includes(k)) ? "present" : "none"}`);
  summaryLines.push(`Native addon risk: ${findings.some((f) => f.id === "deps.native_addons") ? "yes" : "no"}`);
  summaryLines.push(`bun install dry-run: ${install ? (install.ok ? "ok" : "failed") : "skipped"}`);
  summaryLines.push(`bun test: ${test ? (test.ok ? "ok" : "failed") : allowTest ? "running" : "skipped"}`);

  return { severity, summaryLines, findings, install, test, repo };
};
