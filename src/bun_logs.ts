import type { InstallLogAnalysis } from "./types.js";

/**
 * Parse bun install logs to extract blocked dependencies and trusted dependencies information
 * 
 * This function looks for patterns in the output that indicate:
 * - Scripts that were blocked by Bun
 * - Mentions of trustedDependencies
 * - Other relevant notes from the install process
 */
export function parseInstallLogs(logs: string[]): InstallLogAnalysis {
  const blockedDeps: string[] = [];
  const trustedDepsMentioned: string[] = [];
  const notes: string[] = [];

  const blockedKeywords = ["blocked", "not allowed", "lifecycle script", "postinstall blocked", "prepare blocked"];
  const trustedKeywords = ["trustedDependencies", "trusted", "trust"];

  for (const log of logs) {
    const lowerLog = log.toLowerCase();

    // Check for blocked scripts
    for (const keyword of blockedKeywords) {
      if (lowerLog.includes(keyword)) {
        // Try to extract package name from the log
        // Try package@version pattern first
        let pkgMatch = log.match(/blocked:\s+(?:lifecycle\s+script\s+(?:for\s+)?)?(@?[a-z0-9-]+\/[a-z0-9-]+|@?[a-z0-9-]+)@[\d.^]+/i);
        if (pkgMatch && pkgMatch[1] && !blockedDeps.includes(pkgMatch[1])) {
          blockedDeps.push(pkgMatch[1]);
        } else {
          // Fallback: look for package name after blocked: (without version)
          const fallbackMatch = log.match(/blocked:\s+(?:lifecycle\s+script\s+(?:for\s+)?)?(@?[a-z0-9-]+\/[a-z0-9-]+|@?[a-z0-9-]+)/i);
          if (fallbackMatch && fallbackMatch[1] && !blockedDeps.includes(fallbackMatch[1]) && !blockedKeywords.includes(fallbackMatch[1].toLowerCase())) {
            blockedDeps.push(fallbackMatch[1]);
          }
        }
        break;
      }
    }

    // Check for trusted dependencies mentions
    for (const keyword of trustedKeywords) {
      if (lowerLog.includes(keyword)) {
        if (!notes.some(n => n.toLowerCase().includes(keyword))) {
          notes.push(log.trim());
        }
        
        // Try to extract package names from trusted dependencies context
        const pkgMatch = log.match(/@?[a-z0-9-]+\/[a-z0-9-]+|@?[a-z0-9-]+/gi);
        if (pkgMatch) {
          for (const pkg of pkgMatch) {
            if (pkg.toLowerCase() !== "trusteddependencies" && !trustedDepsMentioned.includes(pkg)) {
              trustedDepsMentioned.push(pkg);
            }
          }
        }
        break;
      }
    }

    // Check for other relevant notes
    if (lowerLog.includes("warning") || lowerLog.includes("warn")) {
      notes.push(log.trim());
    }
  }

  // Stable sorting
  blockedDeps.sort((a, b) => a.localeCompare(b));
  trustedDepsMentioned.sort((a, b) => a.localeCompare(b));
  notes.sort();

  return {
    blockedDeps,
    trustedDepsMentioned,
    notes
  };
}

/**
 * Check if install logs indicate any issues
 */
export function hasInstallIssues(logAnalysis: InstallLogAnalysis): boolean {
  return logAnalysis.blockedDeps.length > 0 || logAnalysis.notes.length > 0;
}

/**
 * Get severity for install log analysis
 * - RED if scripts were blocked
 * - YELLOW if trustedDependencies were mentioned or warnings present
 * - GREEN otherwise
 */
export function getInstallSeverity(logAnalysis: InstallLogAnalysis): "green" | "yellow" | "red" {
  if (logAnalysis.blockedDeps.length > 0) {
    return "red";
  }
  if (logAnalysis.trustedDepsMentioned.length > 0 || logAnalysis.notes.length > 0) {
    return "yellow";
  }
  return "green";
}
