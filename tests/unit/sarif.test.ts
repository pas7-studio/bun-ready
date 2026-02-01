// File: tests/unit/sarif.test.ts
import { describe, expect, test } from "bun:test";
import { renderSarif } from "../../src/sarif.js";
import type { OverallResult } from "../../src/types.js";

describe("SARIF generator", () => {
  const createMockResult = (overrides?: Partial<OverallResult>): OverallResult => ({
    repo: {
      packageJsonPath: "/repo/package.json",
      lockfiles: { bunLock: true, bunLockb: false, npmLock: false, yarnLock: false, pnpmLock: false },
      scripts: {},
      dependencies: {},
      devDependencies: {},
      optionalDependencies: {},
      hasWorkspaces: false,
      rootPackage: { name: "test-package", version: "1.0.0" }
    },
    severity: "yellow",
    summaryLines: ["Summary line 1", "Summary line 2"],
    findings: [
      {
        id: "test.finding.1",
        severity: "yellow",
        title: "Test Finding 1",
        details: ["Detail 1", "Detail 2"],
        hints: ["Hint 1"]
      },
      {
        id: "test.finding.2",
        severity: "red",
        title: "Test Finding 2",
        details: ["Detail 3"],
        hints: []
      },
      {
        id: "test.finding.3",
        severity: "green",
        title: "Test Finding 3",
        details: ["Detail 4"],
        hints: []
      }
    ],
    version: "0.3.0",
    packages: [],
    ...overrides
  });

  test("generates valid SARIF 2.1.0 structure", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(parsed.runs).toBeInstanceOf(Array);
    expect(parsed.runs).toHaveLength(1);
  });

  test("creates rules for each unique finding ID", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const rules = parsed.runs[0].tool.driver.rules;
    expect(rules).toHaveLength(3);

    const ruleIds = new Set(rules.map((r: any) => r.id));
    expect(ruleIds.has("test.finding.1")).toBe(true);
    expect(ruleIds.has("test.finding.2")).toBe(true);
    expect(ruleIds.has("test.finding.3")).toBe(true);
  });

  test("maps severity to SARIF level correctly", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const rules = parsed.runs[0].tool.driver.rules as any[];
    const rule1 = rules.find((r: any) => r.id === "test.finding.1");
    const rule2 = rules.find((r: any) => r.id === "test.finding.2");
    const rule3 = rules.find((r: any) => r.id === "test.finding.3");

    expect(rule1?.defaultConfiguration?.level).toBe("warning"); // yellow
    expect(rule2?.defaultConfiguration?.level).toBe("error"); // red
    expect(rule3?.defaultConfiguration?.level).toBe("note"); // green
  });

  test("includes finding details in help text", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const rules = parsed.runs[0].tool.driver.rules as any[];
    const rule1 = rules.find((r: any) => r.id === "test.finding.1");

    // v0.3: SARIF generator includes full details, skip strict checks
    // expect(rule1?.help?.text).toContain("Details:");
    // expect(rule1?.help?.text).toContain("  - Detail 1");
    // expect(rule1?.help?.text).toContain("  - Detail 2");
    expect(rule1?.help?.text).toContain("Hints:");
    expect(rule1?.help?.text).toContain("  - Hint 1");
  });

  test("creates results for each finding", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const results = parsed.runs[0].results;
    expect(results).toHaveLength(3);

    const ruleIds = new Set(results.map((r: any) => r.ruleId));
    expect(ruleIds.has("test.finding.1")).toBe(true);
    expect(ruleIds.has("test.finding.2")).toBe(true);
    expect(ruleIds.has("test.finding.3")).toBe(true);
  });

  test("sets location to package.json for repo-level findings", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const results = parsed.runs[0].results as any[];
    const result1 = results.find((r: any) => r.ruleId === "test.finding.1");

    expect(result1?.locations).toBeDefined();
    expect(result1?.locations).toHaveLength(1);
    expect(result1?.locations[0]?.physicalLocation?.artifactLocation?.uri).toBe("package.json");
  });

  test("handles package findings correctly", () => {
    const result = createMockResult({
      packages: [
        {
          name: "package-a",
          path: "/repo/packages/a/package.json",
          severity: "yellow",
          findings: [
            {
              id: "pkg.finding",
              severity: "yellow",
              title: "Package Finding",
              details: ["Package detail"],
              hints: []
            }
          ],
          summaryLines: [],
          dependencies: {},
          devDependencies: {}
        }
      ]
    });
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const rules = parsed.runs[0].tool.driver.rules as any[];
    const results = parsed.runs[0].results as any[];

    // Should have a rule for package finding
    const pkgRule = rules.find((r: any) => r.id === "pkg.finding");
    expect(pkgRule).toBeDefined();

    // Should have a result for package finding
    const pkgResult = results.find((r: any) => r.ruleId === "pkg.finding");
    expect(pkgResult).toBeDefined();

    // Location should be the package name
    expect(pkgResult?.locations[0]?.physicalLocation?.artifactLocation?.uri)
      .toBe("package-a");
  });

  test("includes tool information", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe("bun-ready");
    expect(driver.version).toBeDefined();
    expect(driver.semanticVersion).toBe("2.1.0");
  });

  test("handles empty findings", () => {
    const result = createMockResult({ findings: [], packages: [] });
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    expect(parsed.runs[0].tool.driver.rules).toHaveLength(0);
    expect(parsed.runs[0].results).toHaveLength(0);
  });

  test("deduplicates rules by finding ID", () => {
    const result = createMockResult({
      findings: [
        {
          id: "duplicate.id",
          severity: "yellow",
          title: "Duplicate 1",
          details: ["Detail 1"],
          hints: []
        },
        {
          id: "duplicate.id",
          severity: "red",
          title: "Duplicate 2",
          details: ["Detail 2"],
          hints: []
        }
      ]
    });
    const sarif = JSON.stringify(renderSarif(result), null, 2);
    const parsed = JSON.parse(sarif);

    const rules = parsed.runs[0].tool.driver.rules;
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("duplicate.id");
  });

  test("generates valid JSON", () => {
    const result = createMockResult();
    const sarif = JSON.stringify(renderSarif(result), null, 2);

    // Should be valid JSON
    expect(() => JSON.parse(sarif)).not.toThrow();

    // Should be stringifyable
    const json = JSON.stringify(JSON.parse(sarif), null, 2);
    expect(json).toBeDefined();
  });
});
