// File: src/sarif.ts
// SARIF 2.1.0 generator for bun-ready

import path from "node:path";
import type {
  Finding,
  OverallResult,
  SarifLog,
  SarifRule,
  SarifResult,
  SarifLocation,
  SarifLevel,
  Severity
} from "./types.js";

/**
 * Convert severity to SARIF level
 */
export function severityToSarifLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case "green":
      return "note";
    case "yellow":
      return "warning";
    case "red":
      return "error";
  }
}

/**
 * Create SARIF rule from finding metadata
 */
export function createSarifRule(finding: Finding): SarifRule {
  // Ensure we always have valid strings for SARIF
  const descriptionText = finding.details.length > 0 ? finding.details[0] : finding.title;
  const fullDesc: { text: string } = { text: descriptionText as string };

  // Build help text with details and hints
  const helpParts: string[] = [];
  if (finding.details.length > 0) {
    helpParts.push("Details:");
    finding.details.forEach((d) => helpParts.push(`  - ${d}`));
  }
  if (finding.hints.length > 0) {
    helpParts.push("Hints:");
    finding.hints.forEach((h) => helpParts.push(`  - ${h}`));
  }
  const helpText = helpParts.length > 0 ? helpParts.join("\n") : "No hints available";

  return {
    id: finding.id,
    shortDescription: {
      text: finding.title
    },
    fullDescription: fullDesc,
    help: {
      text: helpText
    },
    defaultConfiguration: {
      level: severityToSarifLevel(finding.severity)
    }
  };
}

/**
 * Determine finding location
 */
export function determineFindingLocation(
  finding: Finding,
  repoPath: string,
  packageName?: string
): SarifLocation {
  // For repo level findings, use basename of package.json
  if (!packageName) {
    return {
      physicalLocation: {
        artifactLocation: {
          uri: path.basename(repoPath)
        }
      }
    };
  }

  // For package level findings, use the package name directly
  const relativePath = packageName === "root" ? "package.json" : packageName;
  return {
    physicalLocation: {
      artifactLocation: {
        uri: relativePath
      }
    }
  };
}

/**
 * Create SARIF result from finding
 */
export function createSarifResult(
  finding: Finding,
  repoPath: string,
  packageName?: string
): SarifResult {
  // Build message parts
  const messageParts: string[] = [finding.title];
  if (finding.details.length > 0) {
    messageParts.push("");
    messageParts.push("Details:");
    messageParts.push(...finding.details.map((d) => `- ${d}`));
  }

  const messageText = messageParts.join("\n");

  return {
    ruleId: finding.id,
    level: severityToSarifLevel(finding.severity),
    message: {
      text: messageText
    },
    locations: [determineFindingLocation(finding, repoPath, packageName)]
  };
}

/**
 * Render SARIF log from result
 */
export function renderSarif(result: OverallResult): SarifLog {
  // Collect unique findings across all packages
  const allFindings = [...result.findings];
  if (result.packages) {
    for (const pkg of result.packages) {
      for (const finding of pkg.findings) {
        // Only add if not duplicate (by id)
        if (!allFindings.some((f) => f.id === finding.id)) {
          allFindings.push(finding);
        }
      }
    }
  }

  // Create rules (one per unique finding id)
  const rulesMap = new Map<string, SarifRule>();
  for (const finding of allFindings) {
    if (!rulesMap.has(finding.id)) {
      rulesMap.set(finding.id, createSarifRule(finding));
    }
  }
  const rules = Array.from(rulesMap.values()).sort((a, b) => a.id.localeCompare(b.id));

  // Create results
  const results: SarifResult[] = [];
  for (const finding of result.findings) {
    results.push(createSarifResult(finding, result.repo.packageJsonPath, "root"));
  }
  for (const pkg of result.packages || []) {
    // Use the package name directly
    const packageName = pkg.name;
    for (const finding of pkg.findings) {
      results.push(createSarifResult(finding, result.repo.packageJsonPath, packageName));
    }
  }

  // Build SARIF log
  const sarifLog: SarifLog = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "bun-ready",
            version: result.version || "0.3.0",
            semanticVersion: "2.1.0",
            rules
          }
        },
        results
      }
    ]
  };

  return sarifLog;
}
