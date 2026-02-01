// File: tests/unit/baseline.test.ts
import { describe, expect, test } from "bun:test";
import {
  createFindingFingerprint,
  calculateBaselineMetrics,
  compareFindings
} from "../../src/baseline.js";
import type { Finding, PackageAnalysis } from "../../src/types.js";

describe("baseline module", () => {
  describe("createFindingFingerprint", () => {
    test("creates fingerprint with correct structure", () => {
      const finding: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test Finding",
        details: ["detail1", "detail2"],
        hints: ["hint1"]
      };

      const fingerprint = createFindingFingerprint(finding, "test-package");

      expect(fingerprint).toEqual({
        id: "test.finding",
        packageName: "test-package",
        severity: "yellow",
        detailsHash: expect.any(String)
      });

      // Details hash should be stable
      const fingerprint2 = createFindingFingerprint(finding, "test-package");
      expect(fingerprint.detailsHash).toBe(fingerprint2.detailsHash);
    });

    test("uses 'root' as default package name", () => {
      const finding: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["detail"],
        hints: []
      };

      const fingerprint = createFindingFingerprint(finding);

      expect(fingerprint.packageName).toBe("root");
    });

    test("creates different hashes for different details", () => {
      const finding1: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["detail1"],
        hints: []
      };

      const finding2: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["detail2"],
        hints: []
      };

      const fp1 = createFindingFingerprint(finding1);
      const fp2 = createFindingFingerprint(finding2);

      expect(fp1.detailsHash).not.toBe(fp2.detailsHash);
    });

    test("creates same hash for same details in different order", () => {
      const finding1: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["detail1", "detail2", "detail3"],
        hints: []
      };

      const finding2: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["detail3", "detail1", "detail2"],
        hints: []
      };

      const fp1 = createFindingFingerprint(finding1);
      const fp2 = createFindingFingerprint(finding2);

      expect(fp1.detailsHash).toBe(fp2.detailsHash);
    });

    test("creates case-insensitive hashes", () => {
      const finding1: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["Detail1", "DETAIL2"],
        hints: []
      };

      const finding2: Finding = {
        id: "test.finding",
        severity: "yellow",
        title: "Test",
        details: ["detail1", "detail2"],
        hints: []
      };

      const fp1 = createFindingFingerprint(finding1);
      const fp2 = createFindingFingerprint(finding2);

      expect(fp1.detailsHash).toBe(fp2.detailsHash);
    });
  });

  describe("calculateBaselineMetrics", () => {
    test("calculates correct counts for findings", () => {
      const findings = [
        { id: "f1", severity: "green" as const, title: "G1", details: [], hints: [] },
        { id: "f2", severity: "green" as const, title: "G2", details: [], hints: [] },
        { id: "f3", severity: "yellow" as const, title: "Y1", details: [], hints: [] },
        { id: "f4", severity: "yellow" as const, title: "Y2", details: [], hints: [] },
        { id: "f5", severity: "yellow" as const, title: "Y3", details: [], hints: [] },
        { id: "f6", severity: "red" as const, title: "R1", details: [], hints: [] }
      ];

      const packages: PackageAnalysis[] = [];

      const metrics = calculateBaselineMetrics(findings, packages);

      expect(metrics).toEqual({
        totalFindings: 6,
        greenCount: 2,
        yellowCount: 3,
        redCount: 1,
        packagesGreen: 0,
        packagesYellow: 0,
        packagesRed: 0
      });
    });

    test("calculates correct package severities", () => {
      const findings: Finding[] = [];
      const packages: PackageAnalysis[] = [
        {
          name: "pkg1",
          path: "/path1",
          severity: "green",
          findings: [],
          summaryLines: [],
          dependencies: {},
          devDependencies: {}
        },
        {
          name: "pkg2",
          path: "/path2",
          severity: "yellow",
          findings: [],
          summaryLines: [],
          dependencies: {},
          devDependencies: {}
        },
        {
          name: "pkg3",
          path: "/path3",
          severity: "red",
          findings: [],
          summaryLines: [],
          dependencies: {},
          devDependencies: {}
        }
      ];

      const metrics = calculateBaselineMetrics(findings, packages);

      expect(metrics).toEqual({
        totalFindings: 0,
        greenCount: 0,
        yellowCount: 0,
        redCount: 0,
        packagesGreen: 1,
        packagesYellow: 1,
        packagesRed: 1
      });
    });

    test("handles empty inputs", () => {
      const metrics = calculateBaselineMetrics([], []);

      expect(metrics).toEqual({
        totalFindings: 0,
        greenCount: 0,
        yellowCount: 0,
        redCount: 0,
        packagesGreen: 0,
        packagesYellow: 0,
        packagesRed: 0
      });
    });
  });

  describe("compareFindings", () => {
    test("detects new findings", () => {
      const baseline = [
        createFindingFingerprint({
          id: "old.finding",
          severity: "yellow",
          title: "Old",
          details: ["detail"],
          hints: []
        })
      ];

      const current = [
        ...baseline,
        createFindingFingerprint({
          id: "new.finding",
          severity: "yellow",
          title: "New",
          details: ["detail"],
          hints: []
        })
      ];

      const comparison = compareFindings(baseline, current);

      expect(comparison.newFindings).toHaveLength(1);
      expect(comparison.newFindings[0].id).toBe("new.finding");
      expect(comparison.resolvedFindings).toHaveLength(0);
      expect(comparison.severityChanges).toHaveLength(0);
      expect(comparison.isRegression).toBe(false);
    });

    test("detects resolved findings", () => {
      const baseline = [
        createFindingFingerprint({
          id: "old.finding",
          severity: "yellow",
          title: "Old",
          details: ["detail"],
          hints: []
        }),
        createFindingFingerprint({
          id: "resolved.finding",
          severity: "yellow",
          title: "Resolved",
          details: ["detail"],
          hints: []
        })
      ];

      const current = [
        createFindingFingerprint({
          id: "old.finding",
          severity: "yellow",
          title: "Old",
          details: ["detail"],
          hints: []
        })
      ];

      const comparison = compareFindings(baseline, current);

      expect(comparison.newFindings).toHaveLength(0);
      expect(comparison.resolvedFindings).toHaveLength(1);
      expect(comparison.resolvedFindings[0].id).toBe("resolved.finding");
      expect(comparison.severityChanges).toHaveLength(0);
      expect(comparison.isRegression).toBe(false);
    });

    test("detects severity changes", () => {
      const baseline = [
        createFindingFingerprint({
          id: "changed.finding",
          severity: "yellow",
          title: "Changed",
          details: ["detail"],
          hints: []
        })
      ];

      const current = [
        createFindingFingerprint({
          id: "changed.finding",
          severity: "red",
          title: "Changed",
          details: ["detail"],
          hints: []
        })
      ];

      const comparison = compareFindings(baseline, current);

      expect(comparison.newFindings).toHaveLength(0);
      expect(comparison.resolvedFindings).toHaveLength(0);
      expect(comparison.severityChanges).toHaveLength(1);
      expect(comparison.severityChanges[0].fingerprint.id).toBe("changed.finding");
      expect(comparison.severityChanges[0].oldSeverity).toBe("yellow");
      expect(comparison.severityChanges[0].newSeverity).toBe("red");
    });

    test("detects regression from new RED findings", () => {
      const baseline = [
        createFindingFingerprint({
          id: "old.finding",
          severity: "yellow",
          title: "Old",
          details: ["detail"],
          hints: []
        })
      ];

      const current = [
        ...baseline,
        createFindingFingerprint({
          id: "new.red",
          severity: "red",
          title: "New Red",
          details: ["detail"],
          hints: []
        })
      ];

      const comparison = compareFindings(baseline, current);

      expect(comparison.isRegression).toBe(true);
      expect(comparison.regressionReasons).toHaveLength(1);
      expect(comparison.regressionReasons[0]).toContain("New RED findings");
    });

    test("detects regression from severity upgraded to RED", () => {
      const baseline = [
        createFindingFingerprint({
          id: "upgraded.finding",
          severity: "yellow",
          title: "Upgraded",
          details: ["detail"],
          hints: []
        })
      ];

      const current = [
        createFindingFingerprint({
          id: "upgraded.finding",
          severity: "red",
          title: "Upgraded",
          details: ["detail"],
          hints: []
        })
      ];

      const comparison = compareFindings(baseline, current);

      expect(comparison.isRegression).toBe(true);
      expect(comparison.regressionReasons).toHaveLength(1);
      expect(comparison.regressionReasons[0]).toContain("Severity upgraded to RED");
    });

    test("no regression with same findings", () => {
      const baseline = [
        createFindingFingerprint({
          id: "same1",
          severity: "yellow",
          title: "Same1",
          details: ["detail"],
          hints: []
        }),
        createFindingFingerprint({
          id: "same2",
          severity: "green",
          title: "Same2",
          details: ["detail"],
          hints: []
        })
      ];

      const current = [...baseline];

      const comparison = compareFindings(baseline, current);

      expect(comparison.isRegression).toBe(false);
      expect(comparison.newFindings).toHaveLength(0);
      expect(comparison.resolvedFindings).toHaveLength(0);
      expect(comparison.severityChanges).toHaveLength(0);
    });

    test("handles empty baseline and current", () => {
      const comparison = compareFindings([], []);

      expect(comparison.newFindings).toHaveLength(0);
      expect(comparison.resolvedFindings).toHaveLength(0);
      expect(comparison.severityChanges).toHaveLength(0);
      expect(comparison.isRegression).toBe(false);
    });

    test("treats findings in different packages as different", () => {
      const baseline = [
        createFindingFingerprint({
          id: "same.finding",
          severity: "yellow",
          title: "Same",
          details: ["detail"],
          hints: []
        }, "pkg1")
      ];

      const current = [
        createFindingFingerprint({
          id: "same.finding",
          severity: "yellow",
          title: "Same",
          details: ["detail"],
          hints: []
        }, "pkg2")
      ];

      const comparison = compareFindings(baseline, current);

      // Should be detected as new (in pkg2) and resolved (from pkg1)
      expect(comparison.newFindings).toHaveLength(1);
      expect(comparison.resolvedFindings).toHaveLength(1);
      expect(comparison.newFindings[0].packageName).toBe("pkg2");
      expect(comparison.resolvedFindings[0].packageName).toBe("pkg1");
    });
  });
});
