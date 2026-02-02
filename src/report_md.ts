import path from "node:path";
import type { OverallResult, Severity, PackageAnalysis, FindingsSummary, BaselineComparison, PolicySummary, RuleAction } from "./types.js";
import { stableSort } from "./util.js";

const badge = (s: Severity): string => {
  if (s === "green") return "🟢 GREEN";
  if (s === "yellow") return "🟡 YELLOW";
  return "🔴 RED";
};

const getReadinessMessage = (severity: Severity, hasRedFindings: boolean): string => {
  if (severity === "green" && !hasRedFindings) {
    return "✅ Congratulations, you're ready to migrate to Bun!";
  }
  if (severity === "yellow") {
    return "⚠️ Migration is possible with some adjustments required";
  }
  return "❌ Not ready for Bun migration due to critical issues";
};

const formatFindingsTable = (summary: FindingsSummary, cleanPackagesCount?: number): string => {
  const lines: string[] = [];
  lines.push(`## Findings Summary`);
  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  
  // Show packages by status (new format)
  if (summary.greenPackagesCount !== undefined) {
    lines.push(`| 🟢 Green packages | ${summary.greenPackagesCount} |`);
  }
  if (summary.yellowPackagesCount !== undefined) {
    lines.push(`| 🟡 Yellow packages | ${summary.yellowPackagesCount} |`);
  }
  if (summary.redPackagesCount !== undefined) {
    lines.push(`| 🔴 Red packages | ${summary.redPackagesCount} |`);
  }
  if (summary.totalPackagesCount !== undefined) {
    lines.push(`| **Total packages** | **${summary.totalPackagesCount}** |`);
  }
  
  // For backwards compatibility show old format if new is not available
  if (summary.greenPackagesCount === undefined) {
    // Show clean packages count if available
    if (cleanPackagesCount !== undefined && cleanPackagesCount > 0) {
      lines.push(`| Clean packages | ${cleanPackagesCount} |`);
    }
    
    lines.push(`| 🟡 Yellow findings | ${summary.yellow} |`);
    lines.push(`| 🔴 Red findings | ${summary.red} |`);
    lines.push(`| **Total packages** | **${summary.total}** |`);
  }
  
  return lines.join("\n");
};

const getTopFindings = (pkg: PackageAnalysis, count: number = 3): string[] => {
  // Sort by severity (red > yellow > green), then by id
  const sorted = [...pkg.findings].sort((a, b) => {
    const severityOrder: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.id.localeCompare(b.id);
  });
  
  return sorted.slice(0, count).map((f) => `${badge(f.severity)} ${f.title}`);
};

const packageRow = (pkg: PackageAnalysis): string => {
  const name = pkg.name;
  const path = pkg.path.replace(/\\/g, "/");
  const severity = badge(pkg.severity);
  const topFindings = getTopFindings(pkg, 2).join(", ") || "No issues";
  return `| ${name} | \`${path}\` | ${severity} | ${topFindings} |`;
};

const formatPackageStats = (pkg: PackageAnalysis): string[] => {
  const lines: string[] = [];
  if (pkg.stats) {
    lines.push(`- Total dependencies: ${pkg.stats.totalDependencies}`);
    lines.push(`- Total devDependencies: ${pkg.stats.totalDevDependencies}`);
    lines.push(`- Clean dependencies: ${pkg.stats.cleanDependencies}`);
    lines.push(`- Clean devDependencies: ${pkg.stats.cleanDevDependencies}`);
    lines.push(`- Dependencies with findings: ${pkg.stats.riskyDependencies}`);
    lines.push(`- DevDependencies with findings: ${pkg.stats.riskyDevDependencies}`);
  }
  if (pkg.packageUsage) {
    lines.push(`- **Total files analyzed**: ${pkg.packageUsage.analyzedFiles}`);
    // Count packages that are actually used in code
    const usedPackages = Array.from(pkg.packageUsage.usageByPackage.values())
      .filter((u) => u.fileCount > 0).length;
    lines.push(`- **Packages used in code**: ${usedPackages}`);
  }
  return lines;
};

const formatPolicyApplied = (policy: PolicySummary): string => {
  const lines: string[] = [];
  lines.push(`## Policy Applied`);
  lines.push(``);
  lines.push(`- **Rules applied**: ${policy.rulesApplied}`);
  lines.push(`- **Findings modified**: ${policy.findingsModified}`);
  lines.push(`- **Findings disabled**: ${policy.findingsDisabled}`);
  lines.push(`- **Severity upgraded**: ${policy.severityUpgraded}`);
  lines.push(`- **Severity downgraded**: ${policy.severityDowngraded}`);
  lines.push(``);
  
  if (policy.rules.length > 0) {
    lines.push(`### Policy Rules`);
    for (const rule of policy.rules) {
      const actionBadge = getPolicyActionBadge(rule.action);
      lines.push(`- **${rule.findingId}**: ${actionBadge}`);
      if (rule.originalSeverity && rule.newSeverity && rule.originalSeverity !== rule.newSeverity) {
        lines.push(`  - ${badge(rule.originalSeverity)} → ${badge(rule.newSeverity)}`);
      }
      if (rule.reason) {
        lines.push(`  - Reason: ${rule.reason}`);
      }
    }
    lines.push(``);
  } else {
    lines.push(`No policy rules were applied.`);
    lines.push(``);
  }
  
  return lines.join("\n");
};

const getPolicyActionBadge = (action: RuleAction): string => {
  if (action === "fail") return "🛑 FAIL";
  if (action === "warn") return "⚠️ WARN";
  if (action === "off") return "🔴 OFF";
  return "🔵 IGNORE";
};

const formatBaselineComparison = (comparison: BaselineComparison): string => {
  const lines: string[] = [];
  lines.push(`## Baseline Comparison`);
  lines.push(``);

  if (comparison.isRegression) {
    lines.push(`🔴 **REGRESSION DETECTED**`);
  } else {
    lines.push(`✅ No regression detected`);
  }
  lines.push(``);

  if (comparison.newFindings.length > 0) {
    lines.push(`### New Findings (${comparison.newFindings.length})`);
    for (const f of comparison.newFindings) {
      const severityBadge = badge(f.severity);
      lines.push(`- ${severityBadge} **${f.id}** in package \`${f.packageName}\``);
    }
    lines.push(``);
  }

  if (comparison.resolvedFindings.length > 0) {
    lines.push(`### Resolved Findings (${comparison.resolvedFindings.length})`);
    for (const f of comparison.resolvedFindings) {
      const severityBadge = badge(f.severity);
      lines.push(`- ${severityBadge} **${f.id}** in package \`${f.packageName}\``);
    }
    lines.push(``);
  }

  if (comparison.severityChanges.length > 0) {
    lines.push(`### Severity Changes (${comparison.severityChanges.length})`);
    for (const c of comparison.severityChanges) {
      const oldBadge = badge(c.oldSeverity);
      const newBadge = badge(c.newSeverity);
      lines.push(`- **${c.fingerprint.id}** in package \`${c.fingerprint.packageName}\`: ${oldBadge} → ${newBadge}`);
    }
    lines.push(``);
  }

  if (comparison.regressionReasons.length > 0) {
    lines.push(`### Regression Reasons`);
    for (const reason of comparison.regressionReasons) {
      lines.push(`- ${reason}`);
    }
    lines.push(``);
  }

  if (comparison.newFindings.length === 0 &&
      comparison.resolvedFindings.length === 0 &&
      comparison.severityChanges.length === 0) {
    lines.push(`No changes detected from baseline.`);
    lines.push(``);
  }

  return lines.join("\n");
};

const formatChangedOnly = (changedPackages: string[], baselineFile?: string): string => {
  const lines: string[] = [];
  lines.push(`## Scanned Packages (Changed-only)`);
  lines.push(``);

  if (changedPackages.length === 0) {
    lines.push(`No packages were identified as changed.`);
  } else {
    lines.push(`The following packages were scanned (only changed packages):`);
    lines.push(``);
    for (const pkgPath of changedPackages) {
      const normalizedPath = pkgPath.replace(/\\/g, "/");
      lines.push(`- \`${normalizedPath}\``);
    }
  }
  lines.push(``);

  // Verdict type
  if (baselineFile) {
    lines.push(`**Verdict type:** Regression verdict (comparing changed packages against baseline)`);
  } else {
    lines.push(`**Verdict type:** Partial verdict (only changed packages scanned, no baseline)`);
    lines.push(`⚠️ Note: This is a partial scan. For complete verdict, provide a baseline file.`);
  }
  lines.push(``);

  return lines.join("\n");
};

export function renderMarkdown(r: OverallResult): string {
  const lines: string[] = [];
  
  // Get Bun version from process.version (this will be the Node version running bun-ready)
  const bunVersion = process.version;
  
  // Check if there are red findings
  const hasRedFindings = r.findings.some((f) => f.severity === "red");
  
  // Get readiness message
  const readinessMessage = getReadinessMessage(r.severity, hasRedFindings);
  
  // Header with tool name and Bun version
  lines.push(`# bun-ready report - Tested with Bun ${bunVersion}`);
  lines.push(``);
  lines.push(readinessMessage);
  lines.push(``);
  
  // Findings Summary Table - calculate package status
  const rootPkgForSummary = r.packages?.find((p) => p.path === path.dirname(r.repo.packageJsonPath));

  const rootFindingsSummary: FindingsSummary = {
    // Old format (deprecated)
    green: r.findings.filter((f) => f.severity === "green").length,
    yellow: r.findings.filter((f) => f.severity === "yellow").length,
    red: r.findings.filter((f) => f.severity === "red").length,
    total: r.findings.length,
    
    // New format - classify packages
    greenPackagesCount: rootPkgForSummary?.greenPackages?.length || 0,
    yellowPackagesCount: rootPkgForSummary?.yellowPackages?.length || 0,
    redPackagesCount: rootPkgForSummary?.redPackages?.length || 0,
    totalPackagesCount: (rootPkgForSummary?.greenPackages?.length || 0) +
                         (rootPkgForSummary?.yellowPackages?.length || 0) +
                         (rootPkgForSummary?.redPackages?.length || 0)
  };
  lines.push(formatFindingsTable(rootFindingsSummary));
  lines.push(``);
  
  lines.push(`**Overall:** ${badge(r.severity)}`);
  lines.push(``);
  lines.push(`## Summary`);
  for (const l of r.summaryLines) lines.push(`- ${l}`);
  lines.push(``);

  // Version info
  if (r.version) {
    lines.push(`**Report version:** ${r.version}`);
    lines.push(``);
  }

  // Config info
  if (r.config) {
    lines.push(`**Configuration:**`);
    const configInfo: string[] = [];
    if (r.config.ignorePackages && r.config.ignorePackages.length > 0) {
      configInfo.push(`Ignored packages: ${r.config.ignorePackages.join(", ")}`);
    }
    if (r.config.ignoreFindings && r.config.ignoreFindings.length > 0) {
      configInfo.push(`Ignored findings: ${r.config.ignoreFindings.join(", ")}`);
    }
    if (r.config.nativeAddonAllowlist && r.config.nativeAddonAllowlist.length > 0) {
      configInfo.push(`Native addon allowlist: ${r.config.nativeAddonAllowlist.join(", ")}`);
    }
    if (r.config.failOn) {
      configInfo.push(`Fail on: ${r.config.failOn}`);
    }
    if (configInfo.length > 0) {
      for (const info of configInfo) {
        lines.push(`- ${info}`);
      }
    } else {
      lines.push(`- Using default configuration`);
    }
    lines.push(``);
  }

  // Policy applied (if available)
  if (r.policyApplied) {
    lines.push(formatPolicyApplied(r.policyApplied));
  }

  // Root package info
  lines.push(`## Root Package`);
  lines.push(`- Path: \`${r.repo.packageJsonPath.replace(/\\/g, "/")}\``);
  lines.push(`- Workspaces: ${r.repo.hasWorkspaces ? "yes" : "no"}`);
  lines.push(`- Name: ${r.repo.rootPackage?.name || "unknown"}`);
  lines.push(`- Version: ${r.repo.rootPackage?.version || "unknown"}`);
  lines.push(``);

  // Packages table (if multiple packages)
  if (r.packages && (r.packages.length > 1 || (r.packages.length === 1 && r.repo.hasWorkspaces))) {
    lines.push(`## Packages Overview`);
    lines.push(`| Package | Path | Status | Key Findings |`);
    lines.push(`|---------|------|--------|--------------|`);
    
    const sortedPackages = stableSort(r.packages!, (p) => p.name);
    for (const pkg of sortedPackages) {
      lines.push(packageRow(pkg));
    }
    lines.push(``);
  }

  // Root install/test results
  const rootPkg = r.packages?.find((p) => p.path === path.dirname(r.repo.packageJsonPath));
  if (rootPkg?.install) {
    lines.push(`## bun install (dry-run)`);
    lines.push(`- Result: ${rootPkg.install.ok ? "ok" : "failed"}`);
    lines.push(`- Summary: ${rootPkg.install.summary}`);
    if (rootPkg.install.logs.length > 0) {
      lines.push(``);
      lines.push("```text");
      for (const l of rootPkg.install.logs) lines.push(l);
      lines.push("```");
    }
    lines.push(``);
  }

  if (rootPkg?.test) {
    lines.push(`## bun test`);
    lines.push(`- Result: ${rootPkg.test.ok ? "ok" : "failed"}`);
    lines.push(`- Summary: ${rootPkg.test.summary}`);
    if (rootPkg.test.logs.length > 0) {
      lines.push(``);
      lines.push("```text");
      for (const l of rootPkg.test.logs) lines.push(l);
      lines.push("```");
    }
    lines.push(``);
  }

  // Root package summary
  const rootPkgForStats = r.packages?.find((p) => p.path === path.dirname(r.repo.packageJsonPath));
  if (rootPkgForStats && rootPkgForStats.stats) {
    lines.push(`## Package Summary`);
    for (const l of formatPackageStats(rootPkgForStats)) lines.push(l);
    lines.push(``);
  }

  // Clean dependencies (only if there are any) - use rootPkg from line 292
  const cleanDeps = (rootPkg?.cleanDependencies || []);
  const cleanDevDeps = (rootPkg?.cleanDevDependencies || []);
  const totalCleanDeps = cleanDeps.length + cleanDevDeps.length;

  if (totalCleanDeps > 0) {
    lines.push(`## Clean Dependencies (✅ GREEN)`);
    lines.push(`**No migration risks detected - ${totalCleanDeps} total packages**`);
    lines.push(``);
    lines.push(`- Dependencies: ${cleanDeps.length}`);
    lines.push(`- DevDependencies: ${cleanDevDeps.length}`);
    lines.push(``);
  }

  // Root findings
  lines.push(`## Root Findings`);
  if (r.findings.length === 0) {
    lines.push(`No findings for root package.`);
  } else {
    const findings = stableSort(r.findings, (f) => `${f.severity}:${f.id}`);
    for (const f of findings) {
      lines.push(`### ${f.title} (${badge(f.severity)})`);
      lines.push(``);
      for (const d of f.details) lines.push(`- ${d}`);
      if (f.hints.length > 0) {
        lines.push(``);
        lines.push(`**Hints:**`);
        for (const h of f.hints) lines.push(`- ${h}`);
      }
      lines.push(``);
    }
  }
  lines.push(``);

  // Baseline comparison (if available)
  if (r.baselineComparison) {
    lines.push(formatBaselineComparison(r.baselineComparison));
  }

  // Changed-only (if available)
  if (r.changedPackages) {
    const baselineFile = (r as any).baselineFile; // Get baseline file if available
    lines.push(formatChangedOnly(r.changedPackages, baselineFile));
  }

  // Per-package findings
  // Only show if multiple packages OR if single package with workspaces
  // Skip for single package without workspaces to avoid duplication with "Root Package"
  if (r.packages && (r.packages.length > 1 || (r.packages.length === 1 && r.repo.hasWorkspaces))) {
    const sortedPackages = stableSort(r.packages, (p) => p.name);
    
    for (const pkg of sortedPackages) {
      lines.push(`## Package: ${pkg.name} (${badge(pkg.severity)})`);
      lines.push(``);
      lines.push(`**Path:** \`${pkg.path.replace(/\\/g, "/")}\``);
      lines.push(``);
      
      // Package summary
      for (const l of pkg.summaryLines) lines.push(`- ${l}`);
      lines.push(``);

      // Package stats
      if (pkg.stats) {
        lines.push(`**Package Summary**`);
        for (const l of formatPackageStats(pkg)) lines.push(l);
        lines.push(``);
      }

      // Package install/test results
      if (pkg.install) {
        lines.push(`**bun install (dry-run):** ${pkg.install.ok ? "ok" : "failed"}`);
        if (pkg.install.logs.length > 0 && pkg.install.logs.length < 10) {
          lines.push(``);
          lines.push("```text");
          for (const l of pkg.install.logs) lines.push(l);
          lines.push("```");
        }
        lines.push(``);
      }

      if (pkg.test) {
        lines.push(`**bun test:** ${pkg.test.ok ? "ok" : "failed"}`);
        if (pkg.test.logs.length > 0 && pkg.test.logs.length < 10) {
          lines.push(``);
          lines.push("```text");
          for (const l of pkg.test.logs) lines.push(l);
          lines.push("```");
        }
        lines.push(``);
      }

      // Package findings
      lines.push(`**Findings:**`);
      if (pkg.findings.length === 0) {
        lines.push(`No findings for this package.`);
      } else {
        const findings = stableSort(pkg.findings, (f) => `${f.severity}:${f.id}`);
        for (const f of findings) {
          lines.push(``);
          lines.push(`### ${f.title} (${badge(f.severity)})`);
          for (const d of f.details) lines.push(`- ${d}`);
          if (f.hints.length > 0) {
            lines.push(`**Hints:**`);
            for (const h of f.hints) lines.push(`- ${h}`);
          }
        }
      }
      lines.push(``);
    }
  }

  return lines.join("\n");
}

/**
 * Render detailed report with all file paths for package usage
 */
export const renderDetailedReport = (r: OverallResult): string => {
  const lines: string[] = [];
  
  // Get Bun version from process.version
  const bunVersion = process.version;
  
  // Check if there are red findings
  const hasRedFindings = r.findings.some((f) => f.severity === "red");
  
  // Get readiness message
  const readinessMessage = getReadinessMessage(r.severity, hasRedFindings);
  
  // Header with tool name and Bun version
  lines.push(`# bun-ready detailed report - Tested with Bun ${bunVersion}`);
  lines.push(``);
  lines.push(readinessMessage);
  lines.push(``);
  
  // Findings Summary Table - calculate package status
  const rootPkgForSummary = r.packages?.find((p) => p.path === path.dirname(r.repo.packageJsonPath));

  const rootFindingsSummary: FindingsSummary = {
    // Old format (deprecated)
    green: r.findings.filter((f) => f.severity === "green").length,
    yellow: r.findings.filter((f) => f.severity === "yellow").length,
    red: r.findings.filter((f) => f.severity === "red").length,
    total: r.findings.length,
    
    // New format - classify packages
    greenPackagesCount: rootPkgForSummary?.greenPackages?.length || 0,
    yellowPackagesCount: rootPkgForSummary?.yellowPackages?.length || 0,
    redPackagesCount: rootPkgForSummary?.redPackages?.length || 0,
    totalPackagesCount: (rootPkgForSummary?.greenPackages?.length || 0) +
                         (rootPkgForSummary?.yellowPackages?.length || 0) +
                         (rootPkgForSummary?.redPackages?.length || 0)
  };
  lines.push(formatFindingsTable(rootFindingsSummary));
  lines.push(``);
  
  lines.push(`**Overall:** ${badge(r.severity)}`);
  lines.push(``);

  // Policy applied (if available)
  if (r.policyApplied) {
    lines.push(formatPolicyApplied(r.policyApplied));
  }

  // Detailed package usage section
  lines.push(`## Detailed Package Usage`);
  lines.push(``);
  
  let hasUsageInfo = false;
  
  // Collect all packages with usage info
  if (r.packages && r.packages.length > 0) {
    const sortedPackages = stableSort(r.packages, (p) => p.name);
    
    for (const pkg of sortedPackages) {
      if (!pkg.packageUsage) continue;
      
      hasUsageInfo = true;
      
      lines.push(`### ${pkg.name}`);
      lines.push(``);
      lines.push(`**Total files analyzed:** ${pkg.packageUsage.analyzedFiles}`);
      lines.push(`**Total packages:** ${pkg.packageUsage.totalPackages}`);
      lines.push(``);
      
      // Get packages sorted by usage count (descending)
      const sortedUsage = Array.from(pkg.packageUsage.usageByPackage.values())
        .filter((u) => u.fileCount > 0)
        .sort((a, b) => b.fileCount - a.fileCount);
      
      if (sortedUsage.length === 0) {
        lines.push(`No package usage detected in source files.`);
        lines.push(``);
        continue;
      }
      
      // List each package and its usage
      for (const usage of sortedUsage) {
        // Get package version from dependencies
        const depVersion = pkg.dependencies[usage.packageName] || pkg.devDependencies[usage.packageName] || "";
        const versionStr = depVersion ? `@${depVersion}` : "";
        
        lines.push(`#### ${usage.packageName}${versionStr} (${usage.fileCount} file${usage.fileCount !== 1 ? "s" : ""})`);
        lines.push(``);
        
        if (usage.filePaths.length > 0) {
          for (const filePath of usage.filePaths) {
            lines.push(`- ${filePath}`);
          }
        } else {
          lines.push(`- No file paths collected`);
        }
        
        lines.push(``);
      }
    }
  }
  
  if (!hasUsageInfo) {
    lines.push(`No package usage information available. Run with --detailed flag to enable usage analysis.`);
    lines.push(``);
  }

  // Clean dependencies (only if there are any)
  const rootPkg = r.packages?.find((p) => p.path === path.dirname(r.repo.packageJsonPath));
  const cleanDeps = rootPkg?.cleanDependencies || [];
  const cleanDevDeps = rootPkg?.cleanDevDependencies || [];
  const totalCleanDeps = cleanDeps.length + cleanDevDeps.length;

  if (totalCleanDeps > 0) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`### Clean Dependencies (✅ GREEN)`);
    lines.push(`**No migration risks detected - ${totalCleanDeps} total packages**`);
    lines.push(``);

    if (cleanDeps.length > 0) {
      lines.push(`#### Dependencies (${cleanDeps.length} packages)`);
      lines.push(``);
      for (const dep of cleanDeps) {
        lines.push(`- ${dep}`);
      }
      lines.push(``);
    }

    if (cleanDevDeps.length > 0) {
      lines.push(`#### DevDependencies (${cleanDevDeps.length} packages)`);
      lines.push(``);
      for (const dep of cleanDevDeps) {
        lines.push(`- ${dep}`);
      }
      lines.push(``);
    }
  }

  // Add regular findings below
  lines.push(`---`);
  lines.push(``);
  
  // Root findings
  lines.push(`## Root Findings`);
  if (r.findings.length === 0) {
    lines.push(`No findings for root package.`);
  } else {
    const findings = stableSort(r.findings, (f) => `${f.severity}:${f.id}`);
    for (const f of findings) {
      lines.push(`### ${f.title} (${badge(f.severity)})`);
      lines.push(``);
      for (const d of f.details) lines.push(`- ${d}`);
      if (f.hints.length > 0) {
        lines.push(``);
        lines.push(`**Hints:**`);
        for (const h of f.hints) lines.push(`- ${h}`);
      }
      lines.push(``);
    }
  }
  lines.push(``);

  // Baseline comparison (if available)
  if (r.baselineComparison) {
    lines.push(formatBaselineComparison(r.baselineComparison));
  }

  // Changed-only (if available)
  if (r.changedPackages) {
    const baselineFile = (r as any).baselineFile; // Get baseline file if available
    lines.push(formatChangedOnly(r.changedPackages, baselineFile));
  }

  return lines.join("\n");
};
