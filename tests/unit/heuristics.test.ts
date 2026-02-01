import { test, expect } from "bun:test";
import { detectNativeAddonRisk, detectScriptRisks } from "../../src/heuristics.js";
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

test("detectNativeAddonRisk: none -> empty", () => {
  const r = baseRepo();
  const f = detectNativeAddonRisk(r);
  expect(f.length).toBe(0);
});

test("detectNativeAddonRisk: sharp -> yellow", () => {
  const r = baseRepo();
  r.dependencies = { sharp: "^0.33.0" };
  const f = detectNativeAddonRisk(r);
  expect(f.length).toBe(1);
  expect(f[0]?.severity).toBe("yellow");
});

test("detectScriptRisks: postinstall -> yellow", () => {
  const r = baseRepo();
  r.scripts = { postinstall: "node -e \"console.log('hi')\"" };
  const f = detectScriptRisks(r);
  expect(f.some((x) => x.id === "scripts.lifecycle")).toBe(true);
});
