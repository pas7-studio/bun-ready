import type { OverallResult, Severity, PackageAnalysis, FindingsSummary } from "./types.js";
import { stableSort } from "./util.js";

const badge = (s: Severity): string => {
  if (s === "green") return "🟢 GREEN";
  if (s === "yellow") return "🟡 YELLOW";
  return "🔴 RED";
};

const getReadinessMessage = (severity: Severity, hasRedFindings: boolean): string => {
  if (severity === "green" && !hasRedFindings) {
    return "✅ Вітаю, ви готові до переходу на Bun!";
  }
  if (severity === "yellow") {
    return "⚠️ Нажаль ви не готові до переходу на Bun, але це можливо з деякими змінами";
  }
  return "❌ Нажаль ви не готові до переходу на Bun через критичні проблеми";
};

const formatFindingsTable = (summary: FindingsSummary): string => {
  const lines: string[] = [];
  lines.push(`## Findings Summary`);
  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| 🟢 Green | ${summary.green} |`);
  lines.push(`| 🟡 Yellow | ${summary.yellow} |`);
  lines.push(`| 🔴 Red | ${summary.red} |`);
  lines.push(`| **Total** | **${summary.total}** |`);
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
  
  // Findings Summary Table - calculate from root findings
  const rootFindingsSummary: FindingsSummary = {
    green: r.findings.filter((f) => f.severity === "green").length,
    yellow: r.findings.filter((f) => f.severity === "yellow").length,
    red: r.findings.filter((f) => f.severity === "red").length,
    total: r.findings.length
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
  const rootPkg = r.packages?.find((p) => p.path === r.repo.packageJsonPath);
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
  const rootPkgForStats = r.packages?.find((p) => p.path === r.repo.packageJsonPath);
  if (rootPkgForStats && rootPkgForStats.stats) {
    lines.push(`## Package Summary`);
    for (const l of formatPackageStats(rootPkgForStats)) lines.push(l);
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

  // Per-package findings
  if (r.packages && r.packages.length > 0) {
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
  
  // Findings Summary Table
  const rootFindingsSummary: FindingsSummary = {
    green: r.findings.filter((f) => f.severity === "green").length,
    yellow: r.findings.filter((f) => f.severity === "yellow").length,
    red: r.findings.filter((f) => f.severity === "red").length,
    total: r.findings.length
  };
  lines.push(formatFindingsTable(rootFindingsSummary));
  lines.push(``);
  
  lines.push(`**Overall:** ${badge(r.severity)}`);
  lines.push(``);
  
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
  
  return lines.join("\n");
};
