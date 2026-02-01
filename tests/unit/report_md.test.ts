import { test, expect } from "bun:test";
import { renderMarkdown } from "../../src/report_md.js";
import type { AnalysisResult } from "../../src/types.js";

test("renderMarkdown: contains overall badge", () => {
  const r: AnalysisResult = {
    severity: "green",
    summaryLines: ["ok"],
    findings: [],
    install: null,
    test: null,
    repo: {
      packageJsonPath: "/repo/package.json",
      lockfiles: { bunLock: true, bunLockb: false, npmLock: false, yarnLock: false, pnpmLock: false },
      scripts: {},
      dependencies: {},
      devDependencies: {},
      optionalDependencies: {},
      hasWorkspaces: false
    }
  };
  const md = renderMarkdown(r);
  expect(md.includes("🟢 GREEN")).toBe(true);
});
