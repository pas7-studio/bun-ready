import { test, expect } from "bun:test";
import path from "node:path";
import { exec } from "../../src/spawn.js";

const cli = path.join(process.cwd(), "src", "cli.ts");

test("cli: green fixture -> exit 2 when no install/test", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "green");
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", path.join(repoPath, "out.md")], process.cwd());
  expect(res.code).toBe(2); // YELLOW - green fixture doesn't have bun.lock in git
});

test("cli: yellow-native fixture -> exit 2 when no install/test", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "yellow-native");
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "md", "--out", path.join(repoPath, "out.md")], process.cwd());
  expect(res.code).toBe(2);
});

test("cli: json output works", async () => {
  const repoPath = path.join(process.cwd(), "tests", "fixtures", "green");
  const out = path.join(repoPath, "out.json");
  const res = await exec("bun", [cli, "scan", repoPath, "--no-install", "--no-test", "--format", "json", "--out", out], process.cwd());
  expect(res.code).toBe(2); // YELLOW - green fixture doesn't have bun.lock in git
  expect(res.stdout.length > 0).toBe(true);
});

test("cli: missing command -> exit 1", async () => {
  const res = await exec("bun", [cli], process.cwd());
  expect(res.code).toBe(1);
});
