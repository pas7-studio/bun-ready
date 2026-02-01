import { test, expect } from "bun:test";
import { calculatePackageStats, calculateFindingsSummary, detectNativeAddonRisk, detectScriptRisks } from "../../src/heuristics.js";
import type { RepoInfo } from "../../src/types.js";
import type { PackageJson } from "../../src/internal_types.js";

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

const basePackage = (): PackageJson => ({
  name: "test-package",
  version: "1.0.0",
  dependencies: {},
  devDependencies: {}
});

test("calculatePackageStats: no dependencies -> all zeros", () => {
  const pkg = basePackage();
  const stats = calculatePackageStats(pkg, []);
  expect(stats.totalDependencies).toBe(0);
  expect(stats.totalDevDependencies).toBe(0);
  expect(stats.cleanDependencies).toBe(0);
  expect(stats.cleanDevDependencies).toBe(0);
  expect(stats.riskyDependencies).toBe(0);
  expect(stats.riskyDevDependencies).toBe(0);
});

test("calculatePackageStats: clean dependencies only", () => {
  const pkg = basePackage();
  pkg.dependencies = {
    "lodash": "^4.17.21",
    "express": "^4.18.2"
  };
  pkg.devDependencies = {
    "jest": "^29.0.0"
  };
  const stats = calculatePackageStats(pkg, []);
  expect(stats.totalDependencies).toBe(2);
  expect(stats.totalDevDependencies).toBe(1);
  expect(stats.cleanDependencies).toBe(2);
  expect(stats.cleanDevDependencies).toBe(1);
  expect(stats.riskyDependencies).toBe(0);
  expect(stats.riskyDevDependencies).toBe(0);
});

test("calculatePackageStats: risky dependencies", () => {
  const pkg = basePackage();
  pkg.dependencies = {
    "lodash": "^4.17.21",
    "sharp": "^0.33.0"
  };
  pkg.devDependencies = {
    "jest": "^29.0.0"
  };
  const findings = [
    {
      id: "deps.native_addons",
      title: "Native addons",
      severity: "yellow" as const,
      details: ["sharp@^0.33.0"],
      hints: ["Check native addons"]
    }
  ];
  const stats = calculatePackageStats(pkg, findings);
  expect(stats.totalDependencies).toBe(2);
  expect(stats.totalDevDependencies).toBe(1);
  expect(stats.cleanDependencies).toBe(1);
  expect(stats.cleanDevDependencies).toBe(1);
  expect(stats.riskyDependencies).toBe(1);
  expect(stats.riskyDevDependencies).toBe(0);
});

test("calculatePackageStats: mixed clean and risky", () => {
  const pkg = basePackage();
  pkg.dependencies = {
    "lodash": "^4.17.21",
    "sharp": "^0.33.0",
    "bcrypt": "^5.1.0"
  };
  pkg.devDependencies = {
    "jest": "^29.0.0",
    "vitest": "^1.0.0"
  };
  const findings = [
    {
      id: "deps.native_addons",
      title: "Native addons",
      severity: "yellow" as const,
      details: ["sharp@^0.33.0", "bcrypt@^5.1.0"],
      hints: ["Check native addons"]
    },
    {
      id: "runtime.dev_tools",
      title: "Dev tools",
      severity: "yellow" as const,
      details: ["vitest@^1.0.0"],
      hints: ["Check dev tools"]
    }
  ];
  const stats = calculatePackageStats(pkg, findings);
  expect(stats.totalDependencies).toBe(3);
  expect(stats.totalDevDependencies).toBe(2);
  expect(stats.cleanDependencies).toBe(1);
  expect(stats.cleanDevDependencies).toBe(1);
  expect(stats.riskyDependencies).toBe(2);
  expect(stats.riskyDevDependencies).toBe(1);
});

test("calculatePackageStats: parse package names from details", () => {
  const pkg = basePackage();
  pkg.dependencies = {
    "sharp": "^0.33.0"
  };
  const findings = [
    {
      id: "deps.native_addons",
      title: "Native addons",
      severity: "yellow" as const,
      details: ["sharp@^0.33.0", "sharp: ^0.33.0"],
      hints: ["Check native addons"]
    }
  ];
  const stats = calculatePackageStats(pkg, findings);
  expect(stats.riskyDependencies).toBe(1);
});

test("calculateFindingsSummary: empty findings", () => {
  const findings: any[] = [];
  const summary = calculateFindingsSummary(findings);
  expect(summary.green).toBe(0);
  expect(summary.yellow).toBe(0);
  expect(summary.red).toBe(0);
  expect(summary.total).toBe(0);
});

test("calculateFindingsSummary: only green findings", () => {
  const findings = [
    {
      id: "test1",
      title: "Test 1",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test2",
      title: "Test 2",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test3",
      title: "Test 3",
      severity: "green" as const,
      details: [],
      hints: []
    }
  ];
  const summary = calculateFindingsSummary(findings);
  expect(summary.green).toBe(3);
  expect(summary.yellow).toBe(0);
  expect(summary.red).toBe(0);
  expect(summary.total).toBe(3);
});

test("calculateFindingsSummary: mixed findings", () => {
  const findings = [
    {
      id: "test1",
      title: "Test 1",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test2",
      title: "Test 2",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test3",
      title: "Test 3",
      severity: "yellow" as const,
      details: [],
      hints: []
    },
    {
      id: "test4",
      title: "Test 4",
      severity: "yellow" as const,
      details: [],
      hints: []
    },
    {
      id: "test5",
      title: "Test 5",
      severity: "yellow" as const,
      details: [],
      hints: []
    }
  ];
  const summary = calculateFindingsSummary(findings);
  expect(summary.green).toBe(2);
  expect(summary.yellow).toBe(3);
  expect(summary.red).toBe(0);
  expect(summary.total).toBe(5);
});

test("calculateFindingsSummary: all severities", () => {
  const findings = [
    {
      id: "test1",
      title: "Test 1",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test2",
      title: "Test 2",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test3",
      title: "Test 3",
      severity: "green" as const,
      details: [],
      hints: []
    },
    {
      id: "test4",
      title: "Test 4",
      severity: "yellow" as const,
      details: [],
      hints: []
    },
    {
      id: "test5",
      title: "Test 5",
      severity: "yellow" as const,
      details: [],
      hints: []
    },
    {
      id: "test6",
      title: "Test 6",
      severity: "red" as const,
      details: [],
      hints: []
    },
    {
      id: "test7",
      title: "Test 7",
      severity: "red" as const,
      details: [],
      hints: []
    }
  ];
  const summary = calculateFindingsSummary(findings);
  expect(summary.green).toBe(3);
  expect(summary.yellow).toBe(2);
  expect(summary.red).toBe(2);
  expect(summary.total).toBe(7);
});

test("calculateFindingsSummary: only red findings", () => {
  const findings = [
    {
      id: "test1",
      title: "Test 1",
      severity: "red" as const,
      details: [],
      hints: []
    },
    {
      id: "test2",
      title: "Test 2",
      severity: "red" as const,
      details: [],
      hints: []
    }
  ];
  const summary = calculateFindingsSummary(findings);
  expect(summary.green).toBe(0);
  expect(summary.yellow).toBe(0);
  expect(summary.red).toBe(2);
  expect(summary.total).toBe(2);
});
