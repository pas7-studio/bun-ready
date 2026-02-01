// File: src/workspaces.ts
import path from "node:path";
import { promises as fs } from "node:fs";
import fsSync from "node:fs";
import { fileExists, readJsonFile } from "./util.js";

export interface WorkspacePackage {
  name: string;
  path: string;
  packageJsonPath: string;
}

type WorkspacesConfig = string[] | { packages: string[] };

type PackageJson = {
  name?: string;
  version?: string;
  workspaces?: WorkspacesConfig;
  packages?: WorkspacesConfig;
};

/**
 * Simple glob matcher for * and ** patterns
 * Lightweight implementation without external dependencies
 */
function globMatch(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  let patternIdx = 0;
  let pathIdx = 0;

  while (patternIdx < patternParts.length && pathIdx < pathParts.length) {
    const patternPart = patternParts[patternIdx];
    const pathPart = pathParts[pathIdx];

    if (patternPart === "**") {
      // Double star matches any number of directories
      if (patternIdx === patternParts.length - 1) {
        return true; // ** at end matches everything
      }
      const nextPatternPart = patternParts[patternIdx + 1];
      // Find next match
      while (pathIdx < pathParts.length && pathParts[pathIdx] !== nextPatternPart) {
        pathIdx++;
      }
      patternIdx++;
    } else if (patternPart === "*") {
      // Single star matches any single directory/file
      patternIdx++;
      pathIdx++;
    } else {
      if (patternPart !== pathPart) {
        return false;
      }
      patternIdx++;
      pathIdx++;
    }
  }

  // Handle trailing ** or patterns
  if (patternIdx < patternParts.length) {
    const remaining = patternParts.slice(patternIdx);
    if (remaining.length === 1 && remaining[0] === "**") {
      return true;
    }
  }

  return patternIdx === patternParts.length && pathIdx === pathParts.length;
}

/**
 * Discover workspace packages from workspaces config
 */
function discoverFromWorkspaces(rootPath: string, workspaces: WorkspacesConfig): string[] {
  const patterns = Array.isArray(workspaces) ? workspaces : workspaces.packages;
  const packages: string[] = [];

  for (const pattern of patterns) {
    // Resolve pattern relative to root
    const patternPath = path.resolve(rootPath, pattern);
    
    // Simple directory listing for * patterns (no recursive scan for **)
    if (pattern.includes("/*") && !pattern.includes("/**")) {
      try {
        const baseDir = path.dirname(patternPath);
        const patternName = path.basename(patternPath);
        const entries = fsSync.readdirSync(baseDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory() && globMatch(patternName, entry.name)) {
            const packagePath = path.join(baseDir, entry.name);
            const pkgJsonPath = path.join(packagePath, "package.json");
            if (fileExistsSync(pkgJsonPath)) {
              packages.push(packagePath);
            }
          }
        }
      } catch {
        // Ignore errors, continue
      }
    }
  }

  return packages;
}

/**
 * Synchronous file exists check for use in discovery
 */
function fileExistsSync(filePath: string): boolean {
  try {
    fsSync.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discover workspace packages from root package.json
 */
export async function discoverWorkspaces(rootPath: string): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  
  // Check if root has workspaces
  const rootPkgJson = path.join(rootPath, "package.json");
  if (!(await fileExists(rootPkgJson))) {
    return packages;
  }

  const rootPkg = await readJsonFile<PackageJson>(rootPkgJson);
  
  // Check for workspaces in package.json
  if (!rootPkg.workspaces && !rootPkg.packages) {
    return packages;
  }

  const workspaces = rootPkg.workspaces || rootPkg.packages;
  if (!workspaces) {
    return packages;
  }

  // Discover packages from workspaces patterns
  const packagePaths = discoverFromWorkspaces(rootPath, workspaces);

  // Read each package to get name and validate
  for (const pkgPath of packagePaths) {
    const pkgJsonPath = path.join(pkgPath, "package.json");
    try {
      const pkg = await readJsonFile<PackageJson>(pkgJsonPath);
      if (pkg.name) {
        packages.push({
          name: pkg.name,
          path: pkgPath,
          packageJsonPath: pkgJsonPath
        });
      }
    } catch {
      // Skip invalid packages
      continue;
    }
  }

  // Stable sorting by name
  packages.sort((a, b) => a.name.localeCompare(b.name));

  return packages;
}

/**
 * Check if root has workspaces configured
 */
export async function hasWorkspaces(rootPath: string): Promise<boolean> {
  const rootPkgJson = path.join(rootPath, "package.json");
  if (!(await fileExists(rootPkgJson))) {
    return false;
  }

  const rootPkg = await readJsonFile<PackageJson>(rootPkgJson);
  return Boolean(rootPkg.workspaces || rootPkg.packages);
}
