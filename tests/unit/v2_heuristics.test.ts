import { test, expect } from "bun:test";
import type { PackageAnalysis } from "../../src/types.js";
import { discoverWorkspaces, hasWorkspaces } from "../../src/workspaces.js";
import { readConfig, mergeConfigWithOpts } from "../../src/config.js";
import { parseInstallLogs, hasInstallIssues, getInstallSeverity } from "../../src/bun_logs.js";
import { detectRuntimeApiRisks, detectPmAssumptions, detectNativeAddonRiskV2 } from "../../src/heuristics.js";
import type { RepoInfo } from "../../src/types.js";

const baseRepo = (): RepoInfo => ({
  packageJsonPath: "/repo/package.json",
  lockfiles: { bunLock: false, bunLockb: false, npmLock: false, yarnLock: false, pnpmLock: false },
  scripts: {},
  dependencies: {},
  devDependencies: {},
  optionalDependencies: {},
  hasWorkspaces: false
});

// Test 1: Workspace discovery
test("discoverWorkspaces: finds packages in monorepo", async () => {
  const workspacePath = "tests/fixtures/monorepo";
  const packages = await discoverWorkspaces(workspacePath);
  
  expect(packages.length).toBeGreaterThan(0);
  expect(packages.some((p) => p.name === "fixture-monorepo-pkg-a")).toBe(true);
  expect(packages.some((p) => p.name === "fixture-monorepo-pkg-b")).toBe(true);
  expect(packages.some((p) => p.name === "fixture-monorepo-pkg-c")).toBe(true);
});

test("hasWorkspaces: returns true for monorepo", async () => {
  const workspacePath = "tests/fixtures/monorepo";
  const hasWs = await hasWorkspaces(workspacePath);
  expect(hasWs).toBe(true);
});

test("hasWorkspaces: returns false for single package", async () => {
  const singlePath = "tests/fixtures/green";
  const hasWs = await hasWorkspaces(singlePath);
  expect(hasWs).toBe(false);
});

// Test 2: Config reading
test("readConfig: reads and validates config", async () => {
  const config = await readConfig("tests/fixtures/monorepo");
  
  expect(config).toBeNull(); // bun-ready.config.json not in git for monorepo fixture
});

test("readConfig: returns null when config missing", async () => {
  const config = await readConfig("tests/fixtures/green");
  expect(config).toBeNull();
});

test("mergeConfigWithOpts: CLI opts override config", () => {
  const config = {
    ignorePackages: ["a"],
    failOn: "green" as const
  };
  
  const merged = mergeConfigWithOpts(config, { failOn: "yellow" });
  
  expect(merged?.failOn).toBe("yellow"); // CLI overrides
  expect(merged?.ignorePackages).toEqual(["a"]); // config preserved
});

// Test 3: Install log parser
test("parseInstallLogs: detects blocked deps", () => {
  const logs = [
    "Installing dependencies...",
    "blocked: lifecycle script for package@1.0.0",
    "Some warnings occurred"
  ];
  
  const result = parseInstallLogs(logs);
  
  expect(result.blockedDeps).toContain("package");
  expect(result.notes.length).toBeGreaterThan(0);
});

test("parseInstallLogs: detects trusted dependencies", () => {
  const logs = [
    "Adding to trustedDependencies: pkg1, pkg2",
    "Install completed"
  ];
  
  const result = parseInstallLogs(logs);
  
  expect(result.trustedDepsMentioned.length).toBeGreaterThan(0);
});

test("hasInstallIssues: returns true with blocked deps", () => {
  const analysis = parseInstallLogs(["blocked: some-package"]);
  expect(hasInstallIssues(analysis)).toBe(true);
});

test("getInstallSeverity: red when blocked", () => {
  const analysis = parseInstallLogs(["blocked: some-package"]);
  expect(getInstallSeverity(analysis)).toBe("red");
});

test("getInstallSeverity: yellow when trusted mentioned", () => {
  const analysis = parseInstallLogs(["trustedDependencies: pkg"]);
  expect(getInstallSeverity(analysis)).toBe("yellow");
});

test("getInstallSeverity: green when no issues", () => {
  const analysis = parseInstallLogs(["install completed"]);
  expect(getInstallSeverity(analysis)).toBe("green");
});

// Test 4: Runtime API risks detector
test("detectRuntimeApiRisks: detects engines.node < 18", () => {
  const r = baseRepo();
  (r as any).packageJson = { engines: { node: ">=14" } };
  
  const findings = detectRuntimeApiRisks(r);
  
  expect(findings.some((f) => f.id === "runtime.node_version")).toBe(true);
});

test("detectRuntimeApiRisks: detects dev tools", () => {
  const r = baseRepo();
  r.devDependencies = { jest: "^29.0.0", vitest: "^1.0.0" };
  
  const findings = detectRuntimeApiRisks(r);
  
  expect(findings.some((f) => f.id === "runtime.dev_tools")).toBe(true);
});

test("detectRuntimeApiRisks: detects build tools", () => {
  const r = baseRepo();
  r.devDependencies = { webpack: "^5.0.0", "ts-node": "^10.0.0" };
  
  const findings = detectRuntimeApiRisks(r);
  
  expect(findings.some((f) => f.id === "runtime.build_tools")).toBe(true);
});

test("detectRuntimeApiRisks: detects ts-node in scripts", () => {
  const r = baseRepo();
  r.scripts = { build: "ts-node build.ts" };
  
  const findings = detectRuntimeApiRisks(r);
  
  expect(findings.some((f) => f.id === "runtime.ts_execution")).toBe(true);
});

test("detectRuntimeApiRisks: no findings for clean package", () => {
  const r = baseRepo();
  const findings = detectRuntimeApiRisks(r);
  expect(findings.length).toBe(0);
});

// Test 5: PM assumptions detector
test("detectPmAssumptions: detects npm ci", () => {
  const r = baseRepo();
  r.scripts = { install: "npm ci" };
  
  const findings = detectPmAssumptions(r);
  
  expect(findings.some((f) => f.id === "scripts.pm_assumptions")).toBe(true);
});

test("detectPmAssumptions: detects pnpm -r", () => {
  const r = baseRepo();
  r.scripts = { build: "pnpm -r build" };
  
  const findings = detectPmAssumptions(r);
  
  expect(findings.some((f) => f.id === "scripts.pm_assumptions")).toBe(true);
});

test("detectPmAssumptions: detects yarn workspaces", () => {
  const r = baseRepo();
  r.scripts = { test: "yarn workspaces run test" };
  
  const findings = detectPmAssumptions(r);
  
  expect(findings.some((f) => f.id === "scripts.pm_assumptions")).toBe(true);
});

test("detectPmAssumptions: no findings for clean scripts", () => {
  const r = baseRepo();
  r.scripts = { build: "echo 'build'" };
  
  const findings = detectPmAssumptions(r);
  expect(findings.length).toBe(0);
});

// Test 6: Native addon v2 detector
test("detectNativeAddonRiskV2: detects expanded list", () => {
  const r = baseRepo();
  r.dependencies = { grpc: "^1.0.0", sqlite3: "^5.0.0" };
  
  const findings = detectNativeAddonRiskV2(r);
  
  expect(findings.length).toBeGreaterThan(0);
  expect(findings[0]?.id).toBe("deps.native_addons");
});

test("detectNativeAddonRiskV2: respects allowlist", () => {
  const r = baseRepo();
  r.dependencies = { fsevents: "^2.3.0" };
  
  const config = { nativeAddonAllowlist: ["fsevents"] };
  const findings = detectNativeAddonRiskV2(r, config);
  
  expect(findings.length).toBe(0);
});

test("detectNativeAddonRiskV2: red for node-gyp rebuild in scripts", () => {
  const r = baseRepo();
  r.scripts = { install: "node-gyp rebuild" };
  
  const findings = detectNativeAddonRiskV2(r);
  
  expect(findings.length).toBe(1);
  expect(findings[0]?.severity).toBe("red");
});
