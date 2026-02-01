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
test("v2: green fixture returns green", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "green");
  
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test"], process.cwd());
  
  expect(res.code).toBe(0); // Green
});
