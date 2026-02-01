// File: src/policy.ts
// Policy engine for applying rules and thresholds to findings

import type {
  Finding,
  PolicyConfig,
  PolicyRule,
  PolicyThresholds,
  Severity,
  PolicySummary,
  AppliedPolicyRule,
  BaselineMetrics,
  FailOnPolicy
} from "./types.js";

// Export types for external use
export type {
  PolicyRule,
  PolicyThresholds,
  PolicyConfig,
  PolicySummary,
  AppliedPolicyRule
} from "./types.js";

/**
 * Apply severity change to a finding
 */
export function applySeverityChange(
  originalSeverity: Severity,
  change: "upgrade" | "downgrade" | "same"
): Severity {
  if (change === "same") return originalSeverity;

  if (change === "upgrade") {
    if (originalSeverity === "green") return "yellow";
    if (originalSeverity === "yellow") return "red";
    return "red"; // red stays red
  }

  // downgrade
  if (originalSeverity === "red") return "yellow";
  if (originalSeverity === "yellow") return "green";
  return "green"; // green stays green
}

/**
 * Parse rule arguments from CLI
 * Format: --rule id=action or --rule id:severityChange
 */
export function parseRuleArgs(ruleArgs: string[]): PolicyRule[] {
  const rules: PolicyRule[] = [];

  for (const arg of ruleArgs) {
    const parts = arg.split(/[=:]/, 2);
    if (parts.length !== 2) continue;

    const [id, actionOrChange] = parts.map((p) => p.trim());

    // Skip if id or actionOrChange is not defined
    if (!id || !actionOrChange) {
      continue;
    }

    // Check if action or severity change
    if (["fail", "warn", "off", "ignore"].includes(actionOrChange)) {
      const actionRule: PolicyRule = {
        id: id as string,
        action: actionOrChange as PolicyRule["action"]
      };
      rules.push(actionRule);
    } else if (["upgrade", "downgrade", "same"].includes(actionOrChange)) {
      const severityRule: PolicyRule = {
        id: id as string,
        severityChange: actionOrChange as PolicyRule["severityChange"]
      };
      rules.push(severityRule);
    }
  }

  return rules;
}

/**
 * Validate policy configuration from BunReadyConfig
 */
export function validatePolicyConfig(policy: unknown): PolicyConfig | null {
  if (!policy || typeof policy !== "object") {
    return null;
  }

  const cfg = policy as Record<string, unknown>;
  const result: PolicyConfig = {};

  // Validate rules
  if (Array.isArray(cfg.rules)) {
    const validRules = cfg.rules.filter(
      (r): r is PolicyRule =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as PolicyRule).id === "string"
    );
    if (validRules.length > 0) {
      result.rules = validRules;
    }
  }

  // Validate thresholds
  if (typeof cfg.thresholds === "object" && cfg.thresholds !== null) {
    const thresholds = cfg.thresholds as Record<string, unknown>;
    const validThresholds: PolicyThresholds = {};

    if (typeof thresholds.maxWarnings === "number") {
      validThresholds.maxWarnings = thresholds.maxWarnings;
    }
    if (typeof thresholds.maxPackagesRed === "number") {
      validThresholds.maxPackagesRed = thresholds.maxPackagesRed;
    }
    if (typeof thresholds.maxPackagesYellow === "number") {
      validThresholds.maxPackagesYellow = thresholds.maxPackagesYellow;
    }

    if (Object.keys(validThresholds).length > 0) {
      result.thresholds = validThresholds;
    }
  }

  // Validate failOn
  if (cfg.failOn && ["green", "yellow", "red"].includes(cfg.failOn as string)) {
    (result as PolicyConfig & { failOn: FailOnPolicy }).failOn = cfg.failOn as FailOnPolicy;
  }

  // Return null if no valid fields found
  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

/**
 * Merge CLI policy config with config file policy
 */
export function mergePolicyConfigs(cliPolicy: PolicyConfig | undefined, configPolicy: PolicyConfig | undefined): PolicyConfig | undefined {
  if (!cliPolicy && !configPolicy) {
    return undefined;
  }

  const result: PolicyConfig = {};

  // Merge rules (CLI rules take priority)
  if (cliPolicy?.rules && cliPolicy.rules.length > 0) {
    result.rules = cliPolicy.rules;
  } else if (configPolicy?.rules && configPolicy.rules.length > 0) {
    result.rules = configPolicy.rules;
  }

  // Merge thresholds (CLI thresholds take priority)
  if (cliPolicy?.thresholds && Object.keys(cliPolicy.thresholds).length > 0) {
    result.thresholds = cliPolicy.thresholds;
  } else if (configPolicy?.thresholds && Object.keys(configPolicy.thresholds).length > 0) {
    result.thresholds = configPolicy.thresholds;
  }

  // Merge failOn (CLI takes priority)
  if (cliPolicy?.failOn) {
    result.failOn = cliPolicy.failOn;
  } else if (configPolicy?.failOn) {
    result.failOn = configPolicy.failOn;
  }

  if (Object.keys(result).length === 0) {
    return undefined;
  }

  return result;
}

/**
 * Check if findings pass thresholds
 */
export function checkThresholds(
  findings: Finding[],
  thresholds: PolicyThresholds
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let pass = true;

  // Count yellow findings
  const yellowCount = findings.filter((f) => f.severity === "yellow").length;
  if (thresholds.maxWarnings !== undefined && yellowCount > thresholds.maxWarnings) {
    pass = false;
    reasons.push(`Too many warnings (${yellowCount} > ${thresholds.maxWarnings})`);
  }

  // Note: packages thresholds need PackageAnalysis, not just findings
  // This is handled in the main apply function

  return { pass, reasons };
}

/**
 * Find matching rule for a finding
 */
function findMatchingRule(findingId: string, rules: PolicyRule[]): PolicyRule | null {
  // First check for exact ID match
  for (const rule of rules) {
    if (rule.id === findingId) {
      return rule;
    }
  }

  // Then check for wildcard
  for (const rule of rules) {
    if (rule.id === "*") {
      return rule;
    }
  }

  return null;
}

/**
 * Apply policy to findings
 */
export function applyPolicy(
  findings: Finding[],
  policy: PolicyConfig,
  metrics?: BaselineMetrics
): {
  modifiedFindings: Finding[];
  summary: PolicySummary;
} {
  const rules = policy.rules || [];
  const thresholds = policy.thresholds;

  const modifiedFindings: Finding[] = [];
  const appliedRules: AppliedPolicyRule[] = [];
  let findingsModified = 0;
  let findingsDisabled = 0;
  let severityUpgraded = 0;
  let severityDowngraded = 0;

  // Apply rules to each finding
  for (const finding of findings) {
    const rule = findMatchingRule(finding.id, rules);

    if (!rule) {
      // No rule applies, keep finding as-is
      modifiedFindings.push(finding);
      continue;
    }

    const applied: AppliedPolicyRule = {
      findingId: finding.id,
      action: rule.action || "ignore",
      originalSeverity: finding.severity
    };

    // Check if finding should be disabled
    if (rule.action === "off" || rule.action === "ignore") {
      findingsDisabled++;
      // Add to applied rules before skipping
      appliedRules.push(applied);
      continue; // Skip this finding
    }

    // Determine final severity based on action and severity change
    let newSeverity = finding.severity;
    let wasModified = false;

    // Apply severity change if specified (e.g., fail:upgrade)
    if (rule.severityChange) {
      newSeverity = finding.severity;
      // First apply action if present
      if (rule.action === "fail") {
        newSeverity = "red";
      } else if (rule.action === "warn") {
        newSeverity = "yellow";
      }
      // Then apply severity change
      newSeverity = applySeverityChange(newSeverity, rule.severityChange);
      if (rule.severityChange === "upgrade") {
        severityUpgraded++;
      } else if (rule.severityChange === "downgrade") {
        severityDowngraded++;
      }
      wasModified = true;
    } else if (rule.action === "fail" || rule.action === "warn") {
      // Apply pure action without severity change
      if (rule.action === "fail") {
        newSeverity = "red";
      } else if (rule.action === "warn") {
        newSeverity = "yellow";
      }
      wasModified = true;

      // Check if severity changed (upgrade or downgrade)
      if (newSeverity !== finding.severity) {
        // Determine if upgrade or downgrade
        const severityOrder: Record<Severity, number> = { green: 0, yellow: 1, red: 2 };
        if (severityOrder[newSeverity as Severity] > severityOrder[finding.severity]) {
          severityUpgraded++;
        } else {
          severityDowngraded++;
        }
      }
    }

    if (wasModified) {
      findingsModified++;
    }

    applied.newSeverity = newSeverity;
    applied.reason = rule.reason;

    modifiedFindings.push({
      ...finding,
      severity: newSeverity
    });

    appliedRules.push(applied);
  }

  // Check thresholds
  let rulesApplied = appliedRules.length;
  if (thresholds && metrics) {
    if (thresholds.maxPackagesRed !== undefined && metrics.packagesRed > thresholds.maxPackagesRed) {
      rulesApplied++;
    }
    if (thresholds.maxPackagesYellow !== undefined && metrics.packagesYellow > thresholds.maxPackagesYellow) {
      rulesApplied++;
    }
  }

  const summary: PolicySummary = {
    rulesApplied,
    findingsModified,
    findingsDisabled,
    severityUpgraded,
    severityDowngraded,
    rules: appliedRules
  };

  return { modifiedFindings, summary };
}

/**
 * PolicyManager class - convenience wrapper for policy operations
 */
export class PolicyManager {
  /**
   * Parse CLI flags into PolicyConfig
   */
  static parseCliFlags(flags: {
    rules?: string[];
    maxWarnings?: number;
    maxPackagesRed?: number;
    maxPackagesYellow?: number;
    failOn?: FailOnPolicy;
  }): PolicyConfig {
    const config: PolicyConfig = {};

    // Parse rules
    if (flags.rules && flags.rules.length > 0) {
      config.rules = parseRuleArgs(flags.rules);
    }

    // Parse thresholds
    if (flags.maxWarnings || flags.maxPackagesRed || flags.maxPackagesYellow) {
      config.thresholds = {};
      if (flags.maxWarnings !== undefined) {
        config.thresholds.maxWarnings = flags.maxWarnings;
      }
      if (flags.maxPackagesRed !== undefined) {
        config.thresholds.maxPackagesRed = flags.maxPackagesRed;
      }
      if (flags.maxPackagesYellow !== undefined) {
        config.thresholds.maxPackagesYellow = flags.maxPackagesYellow;
      }
    }

    // Parse failOn
    if (flags.failOn) {
      config.failOn = flags.failOn;
    }

    return config;
  }

  /**
   * Parse rule arguments from CLI (enhanced version for test compatibility)
   * Format: --rule id=action or --rule id:severityChange or --rule id=action:severityChange
   */
  // NOTE: parseRuleArgsEnhanced is currently not used in CLI
// The CLI uses parseRuleArgs instead
// This method can be used for advanced rule parsing in the future
/*
export function parseRuleArgsEnhanced(ruleArgs: string[]): PolicyRule[] {
    const rules: PolicyRule[] = [];

    for (const arg of ruleArgs) {
      const parts = arg.split(/[=:]/, 2);
      if (parts.length !== 2) continue;

      const [id, actionOrChange] = parts.map((p) => p.trim());

      // Skip if id or actionOrChange is not defined
      if (!id || !actionOrChange) {
        continue;
      }

      // Check if it's combined format (action:severityChange)
      if (actionOrChange.includes(":")) {
        const [action, change] = actionOrChange.split(":", 2).map((p) => p.trim());

        if (["fail", "warn", "off", "ignore"].includes(action) &&
            ["upgrade", "downgrade", "same"].includes(change || "")) {
          const combinedRule: PolicyRule = {
            id: id as string,
            action: action as PolicyRule["action"],
            severityChange: change as PolicyRule["severityChange"]
          };
          rules.push(combinedRule);
        }
        continue;
      }

      // Check if action or severity change
      if (["fail", "warn", "off", "ignore"].includes(actionOrChange)) {
        const actionRule: PolicyRule = {
          id: id as string,
          action: actionOrChange as PolicyRule["action"]
        };
        rules.push(actionRule);
      } else if (["upgrade", "downgrade", "same"].includes(actionOrChange)) {
        const severityRule: PolicyRule = {
          id: id as string,
          severityChange: actionOrChange as PolicyRule["severityChange"]
        };
        rules.push(severityRule);
      }
    }

    return rules;
  }
*/

  /**
   * Apply policy to findings
   */
  static applyPolicy(
    findings: Finding[],
    policy: PolicyConfig,
    metrics?: BaselineMetrics
  ): PolicySummary {
    const result = applyPolicy(findings, policy, metrics);

    // Return the summary as expected by tests
    return result.summary;
  }

  /**
   * Calculate threshold verdict (green/yellow/red)
   */
  static calculateThresholdVerdict(
    findings: Finding[],
    policy: PolicyConfig
  ): Severity {
    const thresholds = policy.thresholds;
    if (!thresholds) {
      return "green";
    }

    const yellowCount = findings.filter((f) => f.severity === "yellow").length;
    const maxWarnings = thresholds.maxWarnings;

    if (maxWarnings !== undefined && yellowCount > maxWarnings) {
      return "yellow";
    }

    return "green";
  }

  /**
   * Get exit code based on verdict and failOn policy
   */
  static getExitCode(verdict: Severity, failOn?: FailOnPolicy): number {
    // If failOn is set to yellow and verdict is yellow, treat as fail (code 3)
    if (failOn === "yellow" && verdict === "yellow") {
      return 3;
    }

    if (verdict === "red") {
      return 3;
    }

    if (verdict === "yellow") {
      return 2;
    }

    return 0;
  }
}
