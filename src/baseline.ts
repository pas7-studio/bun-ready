// File: src/baseline.ts
// Baseline manager for regression detection

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import type {
  Finding,
  FindingFingerprint,
  BaselineData,
  BaselineMetrics,
  BaselineComparison,
  Severity,
  PackageAnalysis
} from "./types.js";

/**
 * Create fingerprint from a finding
 */
export function createFindingFingerprint(
  finding: Finding,
  packageName?: string
): FindingFingerprint {
  // Normalize details and create hash
  const normalizedDetails = finding.details
    .map((d) => d.trim().toLowerCase())
    .sort()
    .join("|");
  const detailsHash = createHash("md5").update(normalizedDetails).digest("hex");

  return {
    id: finding.id,
    packageName: packageName || "root",
    severity: finding.severity,
    detailsHash
  };
}

/**
 * Calculate baseline metrics from findings and packages
 */
export function calculateBaselineMetrics(
  findings: Finding[],
  packages: PackageAnalysis[]
): BaselineMetrics {
  const greenCount = findings.filter((f) => f.severity === "green").length;
  const yellowCount = findings.filter((f) => f.severity === "yellow").length;
  const redCount = findings.filter((f) => f.severity === "red").length;

  const packagesGreen = packages.filter((p) => p.severity === "green").length;
  const packagesYellow = packages.filter((p) => p.severity === "yellow").length;
  const packagesRed = packages.filter((p) => p.severity === "red").length;

  return {
    totalFindings: findings.length,
    greenCount,
    yellowCount,
    redCount,
    packagesGreen,
    packagesYellow,
    packagesRed
  };
}

/**
 * Compare baseline findings with current findings
 */
export function compareFindings(
  baseline: FindingFingerprint[],
  current: FindingFingerprint[]
): BaselineComparison {
  // Create maps for efficient lookup
  const baselineMap = new Map<string, FindingFingerprint>();
  const currentMap = new Map<string, FindingFingerprint>();

  for (const fp of baseline) {
    const key = `${fp.id}:${fp.packageName}:${fp.detailsHash}`;
    baselineMap.set(key, fp);
  }

  for (const fp of current) {
    const key = `${fp.id}:${fp.packageName}:${fp.detailsHash}`;
    currentMap.set(key, fp);
  }

  // Find new findings (in current, not in baseline)
  const newFindings: FindingFingerprint[] = [];
  for (const [key, fp] of currentMap.entries()) {
    if (!baselineMap.has(key)) {
      newFindings.push(fp);
    }
  }

  // Find resolved findings (in baseline, not in current)
  const resolvedFindings: FindingFingerprint[] = [];
  for (const [key, fp] of baselineMap.entries()) {
    if (!currentMap.has(key)) {
      resolvedFindings.push(fp);
    }
  }

  // Find severity changes (same fingerprint, different severity)
  const severityChanges: BaselineComparison["severityChanges"] = [];
  for (const [key, currentFp] of currentMap.entries()) {
    const baselineFp = baselineMap.get(key);
    if (baselineFp && currentFp.severity !== baselineFp.severity) {
      severityChanges.push({
        fingerprint: currentFp,
        oldSeverity: baselineFp.severity,
        newSeverity: currentFp.severity
      });
    }
  }

  // Detect regression
  const regressionReasons: string[] = [];
  let isRegression = false;

  // New RED findings
  const newRedFindings = newFindings.filter((f) => f.severity === "red");
  if (newRedFindings.length > 0) {
    isRegression = true;
    regressionReasons.push(
      `New RED findings detected: ${newRedFindings.map((f) => f.id).join(", ")}`
    );
  }

  // Severity upgraded to RED
  const upgradedToRed = severityChanges.filter((c) => c.newSeverity === "red");
  if (upgradedToRed.length > 0) {
    isRegression = true;
    regressionReasons.push(
      `Severity upgraded to RED: ${upgradedToRed.map((c) => c.fingerprint.id).join(", ")}`
    );
  }

  // Note: Install/test failure regression is handled in main flow

  return {
    newFindings,
    resolvedFindings,
    severityChanges,
    isRegression,
    regressionReasons
  };
}

/**
 * Save baseline to file
 */
export async function saveBaseline(
  baseline: BaselineData,
  filePath: string
): Promise<void> {
  const json = JSON.stringify(baseline, null, 2);
  await fs.writeFile(filePath, json, "utf-8");
}

/**
 * Load baseline from file
 */
export async function loadBaseline(
  filePath: string
): Promise<BaselineData | null> {
  try {
    const json = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(json) as unknown;

    // Validate baseline structure
    if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as BaselineData).version === "string" &&
      typeof (data as BaselineData).timestamp === "string" &&
      Array.isArray((data as BaselineData).findings)
    ) {
      return data as BaselineData;
    }

    return null;
  } catch (error) {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Update existing baseline with new findings
 */
export function updateBaseline(
  existing: BaselineData,
  current: FindingFingerprint[]
): BaselineData {
  return {
    ...existing,
    timestamp: new Date().toISOString(),
    findings: current
  };
}
