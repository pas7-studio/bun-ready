// File: src/changed_only.ts
// Changed packages detector for git diff

import type { WorkspacePackage } from "./workspaces.js";
import type { PackageAnalysis } from "./types.js";
import { exec } from "./spawn.js";

/**
 * Get git diff paths
 */
export async function getGitDiffPaths(
  repoPath: string,
  sinceRef: string
): Promise<string[]> {
  try {
    const res = await exec("git", ["diff", "--name-only", sinceRef], repoPath);
    if (!res.stdout) {
      return [];
    }
    const paths = res.stdout
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return paths;
  } catch (error) {
    // Git command failed (not in git repo or invalid ref)
    return [];
  }
}

/**
 * Check if a path is a workspace package
 */
export function isWorkspacePackage(
  path: string,
  workspacePackages?: WorkspacePackage[]
): boolean {
  if (!workspacePackages || workspacePackages.length === 0) {
    return false;
  }

  for (const wp of workspacePackages) {
    const normalizedPath = path.replace(/\\/g, "/");
    const normalizedWpPath = wp.path.replace(/\\/g, "/");
    if (normalizedPath.startsWith(normalizedWpPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Map paths to packages
 */
export function mapPathsToPackages(
  paths: string[],
  packages: PackageAnalysis[]
): string[] {
  const packageMap = new Map<string, string>();

  for (const pkg of packages) {
    const normalizedPath = pkg.path.replace(/\\/g, "/");
    packageMap.set(normalizedPath, pkg.name);
  }

  const changedPackages = new Set<string>();

  for (const path of paths) {
    // Find the closest package that contains this path
    for (const [pkgPath, pkgName] of packageMap.entries()) {
      const relativePath = path.replace(/\\/g, "/");
      if (relativePath.startsWith(pkgPath)) {
        changedPackages.add(pkgPath);
        break;
      }
    }
  }

  // Sort and return
  return Array.from(changedPackages).sort();
}

/**
 * Detect changed packages
 */
export async function detectChangedPackages(
  repoPath: string,
  sinceRef: string,
  workspacePackages?: WorkspacePackage[]
): Promise<string[]> {
  // Get git diff paths
  const paths = await getGitDiffPaths(repoPath, sinceRef);

  if (paths.length === 0) {
    return [];
  }

  // If we have workspace info, filter paths to workspace packages only
  let filteredPaths = paths;
  if (workspacePackages && workspacePackages.length > 0) {
    filteredPaths = paths.filter((p) => isWorkspacePackage(p, workspacePackages));
  }

  // Note: We can't map to packages without PackageAnalysis
  // This function only detects changed paths
  // The actual mapping is done in the main flow

  return filteredPaths;
}
