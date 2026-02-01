import { describe, it, expect } from "bun:test";
import {
  PolicyManager,
  parseRuleArgs,
  type PolicyRule,
  type PolicyConfig,
  type PolicySummary,
  type AppliedPolicyRule,
} from "../../src/policy.js";
import type { Finding } from "../../src/types.js";

describe("Policy Manager", () => {
  describe("CLI flags parsing", () => {
    it("should parse single rule", () => {
      const config = PolicyManager.parseCliFlags({
        rules: ["deps.native_addons=fail"],
      });
      expect(config.rules).toEqual([
        {
          id: "deps.native_addons",
          action: "fail",
          severityChange: undefined,
          reason: undefined,
        },
      ]);
    });

    it("should parse multiple rules", () => {
      const config = PolicyManager.parseCliFlags({
        rules: [
          "deps.native_addons=fail",
          "scripts.lifecycle=warn",
          "*=ignore",
        ],
      });
      expect(config.rules).toHaveLength(3);
      expect(config.rules?.[0].id).toBe("deps.native_addons");
      expect(config.rules?.[0].action).toBe("fail");
      expect(config.rules?.[1].id).toBe("scripts.lifecycle");
      expect(config.rules?.[1].action).toBe("warn");
      expect(config.rules?.[2].id).toBe("*");
      expect(config.rules?.[2].action).toBe("ignore");
    });

    // v0.3: Skipped - parseRuleArgsEnhanced not currently used
    // it("should parse rule with severity upgrade", () => {
    //   const rules = parseRuleArgsEnhanced(["deps.native_addons=fail:upgrade"]);
    //   expect(rules[0].id).toBe("deps.native_addons");
    //   expect(rules[0].action).toBe("fail");
    //   expect(rules[0].severityChange).toBe("upgrade");
    // });

    // v0.3: Skipped - parseRuleArgsEnhanced not currently used
    // it("should parse rule with severity downgrade", () => {
    //   const rules = parseRuleArgsEnhanced(["deps.native_addons=warn:downgrade"]);
    //   expect(rules[0].id).toBe("deps.native_addons");
    //   expect(rules[0].action).toBe("warn");
    //   expect(rules[0].severityChange).toBe("downgrade");
    // });

    it("should parse max-warnings threshold", () => {
      const config = PolicyManager.parseCliFlags({
        maxWarnings: 5,
      });
      expect(config.thresholds?.maxWarnings).toBe(5);
    });

    it("should parse multiple thresholds", () => {
      const config = PolicyManager.parseCliFlags({
        maxWarnings: 10,
        maxPackagesRed: 2,
        maxPackagesYellow: 5,
      });
      expect(config.thresholds).toEqual({
        maxWarnings: 10,
        maxPackagesRed: 2,
        maxPackagesYellow: 5,
      });
    });

    it("should parse fail-on option", () => {
      const config = PolicyManager.parseCliFlags({
        failOn: "yellow",
      });
      expect(config.failOn).toBe("yellow");
    });
  });

  describe("applyPolicy", () => {
    const mockFindings = [
      {
        id: "deps.native_addons",
        title: "Native addons detected",
        severity: "yellow" as Severity,
        details: ["Found native-addon package"],
        hints: ["Remove or allowlist"],
      },
      {
        id: "scripts.lifecycle",
        title: "Lifecycle scripts",
        severity: "yellow" as Severity,
        details: ["Found preinstall script"],
        hints: ["Remove script"],
      },
      {
        id: "lockfile.missing",
        title: "No lockfile",
        severity: "yellow" as Severity,
        details: ["No lockfile found"],
        hints: ["Add lockfile"],
      },
    ];

    it("should apply fail rule to matching findings", () => {
      const policy: PolicyConfig = {
        rules: [{ id: "deps.native_addons", action: "fail" }],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.findingsModified).toBe(1);
      expect(result.findingsDisabled).toBe(0);
      expect(result.severityUpgraded).toBe(1);
      expect(result.severityDowngraded).toBe(0);
      expect(result.rules.length).toBe(1);

      const rule = result.rules[0];
      expect(rule.findingId).toBe("deps.native_addons");
      expect(rule.action).toBe("fail");
      expect(rule.originalSeverity).toBe("yellow");
      expect(rule.newSeverity).toBe("red");
    });

    it("should apply warn rule to matching findings", () => {
      const policy: PolicyConfig = {
        rules: [{ id: "scripts.lifecycle", action: "warn" }],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.findingsModified).toBe(1);
      expect(result.rules.length).toBe(1);

      const rule = result.rules[0];
      expect(rule.findingId).toBe("scripts.lifecycle");
      expect(rule.action).toBe("warn");
      expect(rule.originalSeverity).toBe("yellow");
      expect(rule.newSeverity).toBe("yellow"); // No change
    });

    it("should apply off rule to disable findings", () => {
      const policy: PolicyConfig = {
        rules: [{ id: "scripts.lifecycle", action: "off" }],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.findingsDisabled).toBe(1);
      expect(result.rules.length).toBe(1);

      const rule = result.rules[0];
      expect(rule.findingId).toBe("scripts.lifecycle");
      expect(rule.action).toBe("off");
    });

    it("should apply ignore rule", () => {
      const policy: PolicyConfig = {
        rules: [{ id: "scripts.lifecycle", action: "ignore" }],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.findingsDisabled).toBe(1);
      expect(result.rules.length).toBe(1);

      const rule = result.rules[0];
      expect(rule.action).toBe("ignore");
    });

    it("should apply wildcard rule to all findings", () => {
      const policy: PolicyConfig = {
        rules: [{ id: "*", action: "warn" }],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.rulesApplied).toBe(3);
      expect(result.rules.length).toBe(3);
    });

    it("should apply multiple rules", () => {
      const policy: PolicyConfig = {
        rules: [
          { id: "deps.native_addons", action: "fail" },
          { id: "scripts.lifecycle", action: "off" },
        ],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.rulesApplied).toBe(2);
      expect(result.findingsModified).toBe(1);
      expect(result.findingsDisabled).toBe(1);
      expect(result.rules.length).toBe(2);
    });

    it("should apply severity upgrade", () => {
      const policy: PolicyConfig = {
        rules: [
          { id: "deps.native_addons", action: "warn", severityChange: "upgrade" },
        ],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.severityUpgraded).toBe(1);
      expect(result.rules[0].originalSeverity).toBe("yellow");
      expect(result.rules[0].newSeverity).toBe("red");
    });

    it("should apply severity downgrade", () => {
      const policy: PolicyConfig = {
        rules: [
          {
            id: "deps.native_addons",
            action: "warn",
            severityChange: "downgrade",
          },
        ],
      };
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.severityDowngraded).toBe(1);
      expect(result.rules[0].originalSeverity).toBe("yellow");
      expect(result.rules[0].newSeverity).toBe("green");
    });

    it("should handle no policy rules", () => {
      const policy: PolicyConfig = {};
      const result = PolicyManager.applyPolicy(mockFindings, policy);

      expect(result.rulesApplied).toBe(0);
      expect(result.findingsModified).toBe(0);
      expect(result.rules.length).toBe(0);
    });

    it("should handle empty findings list", () => {
      const policy: PolicyConfig = {
        rules: [{ id: "*", action: "fail" }],
      };
      const result = PolicyManager.applyPolicy([], policy);

      expect(result.rulesApplied).toBe(0);
      expect(result.rules.length).toBe(0);
    });
  });

  describe("calculateThresholdVerdict", () => {
    const mockFindings = [
      { id: "f1", title: "Finding 1", severity: "yellow" as Severity, details: [], hints: [] },
      { id: "f2", title: "Finding 2", severity: "yellow" as Severity, details: [], hints: [] },
    ];

    it("should return yellow when maxWarnings exceeded", () => {
      const policy: PolicyConfig = {
        thresholds: { maxWarnings: 1 },
      };
      const verdict = PolicyManager.calculateThresholdVerdict(mockFindings, policy);
      expect(verdict).toBe("yellow");
    });

    it("should return green when maxWarnings not exceeded", () => {
      const policy: PolicyConfig = {
        thresholds: { maxWarnings: 5 },
      };
      const verdict = PolicyManager.calculateThresholdVerdict(mockFindings, policy);
      expect(verdict).toBe("green");
    });

    it("should handle no thresholds", () => {
      const policy: PolicyConfig = {};
      const verdict = PolicyManager.calculateThresholdVerdict(mockFindings, policy);
      expect(verdict).toBe("green");
    });

    it("should count yellow severity findings as warnings", () => {
      const findings = [
        { id: "f1", title: "Finding 1", severity: "yellow" as Severity, details: [], hints: [] },
        { id: "f2", title: "Finding 2", severity: "yellow" as Severity, details: [], hints: [] },
        { id: "f3", title: "Finding 3", severity: "green" as Severity, details: [], hints: [] },
      ];
      const policy: PolicyConfig = {
        thresholds: { maxWarnings: 2 },
      };
      const verdict = PolicyManager.calculateThresholdVerdict(findings, policy);
      expect(verdict).toBe("green");
    });
  });

  describe("getExitCode", () => {
    it("should return 0 for green", () => {
      const code = PolicyManager.getExitCode("green", "red");
      expect(code).toBe(0);
    });

    it("should return 2 for yellow", () => {
      const code = PolicyManager.getExitCode("yellow", "red");
      expect(code).toBe(2);
    });

    it("should return 3 for red", () => {
      const code = PolicyManager.getExitCode("red", "red");
      expect(code).toBe(3);
    });

    it("should return 3 for yellow when failOn is yellow", () => {
      const code = PolicyManager.getExitCode("yellow", "yellow");
      expect(code).toBe(3);
    });

    it("should return 0 for green when failOn is green", () => {
      const code = PolicyManager.getExitCode("green", "green");
      expect(code).toBe(0);
    });
  });
});
