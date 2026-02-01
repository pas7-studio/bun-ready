// File: src/usage_analyzer.ts
// Package usage analyzer - tracks which packages are used in which files

import { promises as fs } from "node:fs";
import path from "node:path";
import type { PackageJson } from "./internal_types.js";
import type { PackageUsage, PackageUsageStats } from "./types.js";

// Supported file extensions for analysis
const SUPPORTED_EXTENSIONS = [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs"];

// Regex patterns for import detection
const IMPORT_PATTERNS = [
  // ES6 imports: import ... from 'package-name'
  /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^./][^'"]*)['"]/g,
  // Dynamic imports: import('package-name')
  /import\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/g,
  // CommonJS: require('package-name')
  /require\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/g,
];

/**
 * Extract package names from import statements in file content
 */
export function extractPackageNames(content: string): string[] {
  const packageSet = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const packageName = match[1];
      if (packageName) {
        packageSet.add(packageName);
      }
    }
  }

  return Array.from(packageSet);
}

/**
 * Recursively find all source files in a directory
 */
async function findSourceFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  let entries: any[];

  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    // Skip directories that can't be read
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Skip node_modules and hidden directories
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively search subdirectories
      const subFiles = await findSourceFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Get all package names from package.json (dependencies and devDependencies)
 */
function getAllPackageNames(pkg: PackageJson): Set<string> {
  const packageNames = new Set<string>();

  if (pkg.dependencies) {
    Object.keys(pkg.dependencies).forEach((name) => packageNames.add(name));
  }

  if (pkg.devDependencies) {
    Object.keys(pkg.devDependencies).forEach((name) => packageNames.add(name));
  }

  if (pkg.optionalDependencies) {
    Object.keys(pkg.optionalDependencies).forEach((name) => packageNames.add(name));
  }

  return packageNames;
}

/**
 * Analyze package usage in source files
 * 
 * @param pkg - Package JSON object
 * @param packagePath - Path to the package directory (parent of package.json)
 * @param includeDetails - Whether to collect file paths (default: true)
 * @returns Package usage statistics
 */
export const analyzePackageUsage = (
  pkg: PackageJson,
  packagePath: string,
  includeDetails: boolean = true
): PackageUsageStats => {
  // Note: This is a synchronous stub for type compatibility
  // The actual async implementation should be used
  return {
    totalPackages: 0,
    analyzedFiles: 0,
    usageByPackage: new Map<string, PackageUsage>(),
  };
};

/**
 * Async version of analyzePackageUsage (actual implementation)
 */
export const analyzePackageUsageAsync = async (
  pkg: PackageJson,
  packagePath: string,
  includeDetails: boolean = true
): Promise<PackageUsageStats> => {
  // Get all packages from package.json
  const packageNames = getAllPackageNames(pkg);
  const totalPackages = packageNames.size;

  // Find all source files
  const sourceFiles = await findSourceFiles(packagePath);
  const analyzedFiles = sourceFiles.length;

  // Initialize usage map
  const usageByPackage = new Map<string, PackageUsage>();

  // Initialize empty usage entries for all packages
  for (const pkgName of packageNames) {
    usageByPackage.set(pkgName, {
      packageName: pkgName,
      fileCount: 0,
      filePaths: [],
    });
  }

  // Analyze each file
  for (const filePath of sourceFiles) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const importedPackages = extractPackageNames(content);

      // Match imported packages with known packages
      for (const importedPkg of importedPackages) {
        const usage = usageByPackage.get(importedPkg);
        if (usage) {
          usage.fileCount++;
          if (includeDetails) {
            // Store relative path from package directory
            const relativePath = path.relative(packagePath, filePath);
            usage.filePaths.push(relativePath);
          }
          usageByPackage.set(importedPkg, usage);
        }
      }
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  // Sort file paths for deterministic output
  if (includeDetails) {
    for (const usage of usageByPackage.values()) {
      usage.filePaths.sort();
    }
  }

  return {
    totalPackages,
    analyzedFiles,
    usageByPackage,
  };
};
