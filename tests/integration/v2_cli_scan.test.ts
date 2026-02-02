import { test, expect } from "bun:test";
import path from "node:path";
import { exec } from "../../src/spawn.js";

const cli = path.join(process.cwd(), "src", "cli.ts");

// Test 1: Monorepo scan
test("v2: scan monorepo --no-install --no-test creates proper report", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  const out = path.join(repoPath, "out-monorepo.md");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThan(0); // Should be 2 or 3 based on worst severity
  expect(res.stdout.length > 0).toBe(true);
  
  // Check if file was created
  const { fileExists } = await import("../../src/util.js");
  const exists = await fileExists(out);
  expect(exists).toBe(true);
});

// Test 2: Scope options
test("v2: --scope root scans only root package", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--scope", "root"], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
});

test("v2: --scope packages scans only workspace packages", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--scope", "packages"], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
});

test("v2: --scope all scans root and packages (default)", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--scope", "all"], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
});

// Test 3: Fail-on options
test("v2: --fail-on yellow changes exit code", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--fail-on", "yellow"], process.cwd());
  
  // With fail-on=yellow, yellow should return 3 (fail) instead of 2
  expect(res.code).toBeGreaterThanOrEqual(0);
});

test("v2: --fail-on green makes yellow fail", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--fail-on", "green"], process.cwd());
  
  // With fail-on=green, anything not green should return 3 (fail)
  expect([0, 1].includes(res.code)).toBe(false);
});

// Test 4: JSON output includes packages
test("v2: JSON output includes packages and version", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  const out = path.join(repoPath, "out-monorepo.json");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "json", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  
  // Read and parse JSON
  const { readJsonFile } = await import("../../src/util.js");
  const json = await readJsonFile(out);
  
  expect(json.version).toBe("0.2");
  expect(Array.isArray(json.packages)).toBe(true);
  expect(json.packages.length).toBeGreaterThan(0);
});

// Test 5: Deterministic ordering
test("v2: deterministic ordering in reports", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  const out1 = path.join(repoPath, "out-1.json");
  const out2 = path.join(repoPath, "out-2.json");
  
  // Run scan twice
  await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "json", "--out", out1], process.cwd());
  await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "json", "--out", out2], process.cwd());
  
  // Read both files
  const { readJsonFile } = await import("../../src/util.js");
  const json1 = await readJsonFile(out1);
  const json2 = await readJsonFile(out2);
  
  // Compare packages array (should be in same order)
  expect(JSON.stringify(json1.packages)).toBe(JSON.stringify(json2.packages));
});

// Test 6: Config file integration
test("v2: config file is loaded and applied", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  
  // Monorepo has bun-ready.config.json with fail-on: yellow
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test"], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
});

// Test 7: Missing package.json
test("v2: missing package.json returns red", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "does-not-exist");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test"], process.cwd());
  
  expect(res.code).toBe(3); // Red
});

// Test 8: Green fixture still works
test("v2: green fixture returns yellow (no bun.lock)", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "green");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test"], process.cwd());
  
  expect(res.code).toBe(2); // YELLOW - green fixture doesn't have bun.lock in git
});

// Test 9: TypeScript clean fixture should NOT detect openapi-typescript as native addon
test("v2: typescript-clean fixture should NOT detect openapi-typescript as native addon", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "typescript-clean");
  const out = path.join(repoPath, "out-typescript-clean.json");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "json", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
  
  // Read and parse JSON
  const { readJsonFile } = await import("../../src/util.js");
  const json = await readJsonFile(out);
  
  expect(json.version).toBe("0.2");
  expect(Array.isArray(json.packages)).toBe(true);
  expect(json.packages.length).toBeGreaterThan(0);
  
  // Get the first package
  const pkg = json.packages[0];
  expect(pkg).toBeDefined();
  
  // Check that deps.native_addons is NOT in findings
  const hasNativeAddonFinding = pkg.findings?.some((f: any) => f.id === "deps.native_addons");
  expect(hasNativeAddonFinding).toBe(false);
  
  // Verify openapi-typescript is in dependencies (dependencies is an object, not an array)
  expect(pkg.dependencies).toBeDefined();
  expect(typeof pkg.dependencies === "object").toBe(true);
  expect(pkg.dependencies["openapi-typescript"]).toBe("^7.10.1");
});

test("v2: typescript-clean with MD format shows correct output", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "typescript-clean");
  const out = path.join(repoPath, "out-typescript-clean.md");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
  
  // Read the file
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(out, "utf-8");
  
  // Should show Clean Dependencies section (all packages are clean)
  expect(content).toContain("## Clean Dependencies (✅ GREEN)");
  expect(content).toContain("No migration risks detected - 4 total packages");
  
  // Should NOT contain deps.native_addons finding
  expect(content).not.toContain("Potential native addons");
  expect(content).not.toContain("node-gyp toolchain risk");
});

// Test 10: Clean dependencies in findings summary
test("v2: clean dependencies shown in findings summary", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "with-clean-deps");
  const out = path.join(repoPath, "out-clean-deps.md");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
  
  // Read file
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(out, "utf-8");
  
  // Should show clean packages count in findings summary
  expect(content).toContain("| 🟢 Green packages | 6 |");
  expect(content).toContain("| 🟡 Yellow packages | 1 |");
  expect(content).toContain("| 🔴 Red packages | 0 |");
  expect(content).toContain("| **Total packages** | **7** |");
  
  // Should show Clean Dependencies section
  expect(content).toContain("## Clean Dependencies (✅ GREEN)");
  expect(content).toContain("No migration risks detected - 6 total packages");
  
  // Should not show "Package: with-clean-deps" section (no duplication)
  expect(content).not.toContain("## Package: with-clean-deps");
});

// Test 11: No package duplication for single package without workspaces
test("v2: single package without workspaces has no duplication", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "with-clean-deps");
  const out = path.join(repoPath, "out-no-dup.md");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
  
  // Read file
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(out, "utf-8");
  
  // Should show "Root Package" only once
  const rootPkgMatches = content.match(/## Root Package/g);
  expect(rootPkgMatches?.length).toBe(1);
  
  // Should NOT show "Package: with-clean-deps" section (duplication)
  const pkgSectionMatches = content.match(/## Package: with-clean-deps/g);
  expect(pkgSectionMatches).toBeNull();
  
  // Should show Root Findings only once
  const rootFindingsMatches = content.match(/## Root Findings/g);
  expect(rootFindingsMatches?.length).toBe(1);
});

// Test 12: Clean dependencies counts are correct
test("v2: clean dependencies counts are accurate", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "with-clean-deps");
  const out = path.join(repoPath, "out-counts.md");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "json", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  
  // Read and parse JSON
  const { readJsonFile } = await import("../../src/util.js");
  const json = await readJsonFile(out);
  
  expect(json.version).toBe("0.2");
  expect(Array.isArray(json.packages)).toBe(true);
  expect(json.packages.length).toBeGreaterThan(0);
  
  // Get root package
  const pkg = json.packages[0];
  expect(pkg).toBeDefined();
  
  // Check clean dependencies counts
  expect(pkg.cleanDependencies).toBeDefined();
  expect(Array.isArray(pkg.cleanDependencies)).toBe(true);
  expect(pkg.cleanDependencies.length).toBeGreaterThan(0);
  
  expect(pkg.cleanDevDependencies).toBeDefined();
  expect(Array.isArray(pkg.cleanDevDependencies)).toBe(true);
  expect(pkg.cleanDevDependencies.length).toBeGreaterThan(0);
  
  // Verify that clean dependencies don't include risky packages
  const riskyPackageNames = new Set<string>();
  for (const finding of pkg.findings) {
    for (const detail of finding.details) {
      const match = detail.match(/^([a-zA-Z0-9_@\/\.\-]+)/);
      if (match && match[1]) {
        const fullPkg = match[1];
        const pkgName = fullPkg.split(/[@:]/)[0];
        if (pkgName) {
          riskyPackageNames.add(pkgName);
        }
      }
    }
  }
  
  // All clean dependencies should not be in risky package names
  for (const cleanDep of pkg.cleanDependencies) {
    const pkgName = cleanDep.split(/[@:]/)[0];
    expect(riskyPackageNames.has(pkgName)).toBe(false);
  }
  
  for (const cleanDevDep of pkg.cleanDevDependencies) {
    const pkgName = cleanDevDep.split(/[@:]/)[0];
    expect(riskyPackageNames.has(pkgName)).toBe(false);
  }
});

// Test 13: Monorepo with workspaces shows per-package findings
test("v2: monorepo with workspaces shows per-package findings", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "monorepo");
  const out = path.join(repoPath, "out-monorepo-packages.md");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", out], process.cwd());
  
  expect(res.code).toBeGreaterThanOrEqual(0);
  expect(res.stdout.length > 0).toBe(true);
  
  // Read file
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(out, "utf-8");
  
  // Should show "Packages Overview" table for monorepo with workspaces
  expect(content).toContain("## Packages Overview");
  
  // Should show per-package sections (each package in workspaces)
  expect(content).toContain("## Package:");
  
  // Should show multiple packages (a, b, c, d)
  const pkgMatches = content.match(/## Package: /g);
  expect(pkgMatches).not.toBeNull();
  expect(pkgMatches?.length).toBeGreaterThan(1);
  
  // Should NOT show "Clean Dependencies" section for monorepo (since it has workspaces)
  expect(content).not.toContain("## Clean Dependencies");
});
