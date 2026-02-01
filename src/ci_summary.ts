// File: src/ci_summary.ts
// CI summary generator for stable CI output

import type {
  Finding,
  OverallResult,
  CISummary,
  Severity,
  FailOnPolicy
} from "./types.js";

/**
 * Get top N findings
 */
export function getTopFindings(
  findings: Finding[],
  count: number = 3
): string[] {
  const sorted = [...findings].sort((a, b) => {
    const severityOrder: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.id.localeCompare(b.id);
  });

  const badge = (s: Severity): string => {
    switch (s) {
      case "green":
        return "🟢";
      case "yellow":
        return "🟡";
      case "red":
        return "🔴";
    }
  };

  return sorted.slice(0, count).map((f) => `${badge(f.severity)} ${f.title} (${f.id})`);
}

/**
 * Generate next actions from findings
 */
export function generateNextActions(findings: Finding[]): string[] {
  const actions: string[] = [];
  const actionSet = new Set<string>();

  for (const finding of findings) {
    for (const hint of finding.hints) {
      const action = hint.trim();
      if (!actionSet.has(action)) {
        actions.push(action);
        actionSet.add(action);
      }
    }
  }

  return actions.slice(0, 5); // Top 5 actions
}

/**
 * Calculate exit code based on severity and failOn policy
 */
export function calculateExitCode(
  severity: Severity,
  failOn: FailOnPolicy | undefined
): number {
  // Default behavior: green=0, yellow=2, red=3
  if (!failOn) {
    if (severity === "green") return 0;
    if (severity === "yellow") return 2;
    return 3;
  }

  // Custom failOn policy
  if (failOn === "green") {
    // Fail on anything not green
    if (severity === "green") return 0;
    return 3;
  }
  if (failOn === "yellow") {
    // Fail on red only
    if (severity === "red") return 3;
    return 0;
  }
  // failOn === "red" (same as default)
  if (severity === "green") return 0;
  if (severity === "yellow") return 2;
  return 3;
}

/**
 * Generate CI summary
 */
export function generateCISummary(
  result: OverallResult,
  failOn: FailOnPolicy | undefined
): CISummary {
  const topFindings = getTopFindings(result.findings, 3);
  const nextActions = generateNextActions(result.findings);
  const exitCode = calculateExitCode(result.severity, failOn);

  return {
    verdict: result.severity,
    topFindings,
    nextActions,
    exitCode
  };
}

/**
 * Format CI summary as text (for stdout)
 */
export function formatCISummaryText(summary: CISummary): string {
  const badge = (s: Severity): string => {
    switch (s) {
      case "green":
        return "🟢 GREEN";
      case "yellow":
        return "🟡 YELLOW";
      case "red":
        return "🔴 RED";
    }
  };

  const lines: string[] = [];
  lines.push("=== bun-ready CI Summary ===");
  lines.push("");
  lines.push(`Verdict: ${badge(summary.verdict)}`);
  lines.push("");

  if (summary.topFindings.length > 0) {
    lines.push("Top Issues:");
    for (const finding of summary.topFindings) {
      lines.push(`  - ${finding}`);
    }
    lines.push("");
  }

  if (summary.nextActions.length > 0) {
    lines.push("Next Actions:");
    for (let i = 0; i < summary.nextActions.length; i++) {
      lines.push(`  ${i + 1}. ${summary.nextActions[i]}`);
    }
    lines.push("");
  }

  lines.push(`Exit Code: ${summary.exitCode}`);

  return lines.join("\n");
}

/**
 * Format CI summary as GitHub job summary (markdown)
 */
export function formatGitHubJobSummary(summary: CISummary): string {
  const badge = (s: Severity): string => {
    switch (s) {
      case "green":
        return "🟢 **GREEN**";
      case "yellow":
        return "🟡 **YELLOW**";
      case "red":
        return "🔴 **RED**";
    }
  };

  const lines: string[] = [];
  lines.push("## bun-ready CI Summary");
  lines.push("");
  lines.push(`### Verdict: ${badge(summary.verdict)}`);
  lines.push("");

  if (summary.topFindings.length > 0) {
    lines.push("### Top Issues");
    lines.push("");
    for (const finding of summary.topFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push("");
  }

  if (summary.nextActions.length > 0) {
    lines.push("### Next Actions");
    lines.push("");
    for (let i = 0; i < summary.nextActions.length; i++) {
      lines.push(`${i + 1}. ${summary.nextActions[i]}`);
    }
    lines.push("");
  }

  lines.push(`**Exit Code:** \`${summary.exitCode}\``);

  return lines.join("\n");
}
