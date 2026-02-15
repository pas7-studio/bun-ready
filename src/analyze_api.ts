/**
 * Node.js API Compatibility Analysis
 * 
 * Analyzes source code for Node.js built-in module usage
 * and provides compatibility findings for Bun migration
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Finding } from './types.js';
import { 
  isNodeBuiltinImport, 
  getModuleCategory, 
  getNodeModule,
  hasNodePrefix,
  type ModuleCategory 
} from './node_builtins.js';
import { 
  parseImports, 
  type ParsedImport, 
  type ImportType 
} from './import_parser.js';
import { stableSort } from './util.js';

// Source file extensions to analyze
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.mts', '.mjs', '.cts', '.cjs']);

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.nuxt']);

/**
 * API usage information for a single module
 */
export interface ModuleUsageInfo {
  /** Module name (e.g., 'fs', 'node:crypto') */
  module: string;
  /** Compatibility category */
  category: ModuleCategory;
  /** Files that import this module */
  files: Array<{
    path: string;
    line: number;
    importType: ImportType;
    hasNodePrefix: boolean;
  }>;
  /** Whether node: prefix is recommended */
  recommendsPrefix: boolean;
  /** Bun alternatives if available */
  bunAlternatives?: string[];
  /** Additional notes */
  notes?: string;
}

/**
 * Result of API analysis
 */
export interface ApiAnalysisResult {
  /** All findings generated */
  findings: Finding[];
  /** Usage info by module */
  usageByModule: Map<string, ModuleUsageInfo>;
  /** Summary statistics */
  summary: {
    totalFiles: number;
    totalImports: number;
    greenZone: string[];
    yellowZone: string[];
    redZone: string[];
    withoutNodePrefix: string[];
  };
}

/**
 * Options for API analysis
 */
export interface ApiAnalysisOptions {
  /** Root path to analyze */
  rootPath: string;
  /** File paths to analyze (relative to root) */
  filePaths?: string[];
  /** Skip directories */
  skipDirs?: Set<string>;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Get all source files in a directory recursively
 */
async function getSourceFiles(rootPath: string, skipDirs: Set<string>): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (SOURCE_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  await scan(rootPath);
  return files;
}

/**
 * Analyze a single file for Node.js API usage
 */
async function analyzeFile(
  filePath: string,
  rootPath: string
): Promise<ParsedImport[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const allImports = parseImports(content);
    
    // Filter to only Node.js built-in imports
    const nodeImports = allImports.filter(imp => isNodeBuiltinImport(imp.modulePath));
    
    return nodeImports;
  } catch {
    return [];
  }
}

/**
 * Analyze Node.js API usage in a project
 */
export async function analyzeNodeApiUsage(
  options: ApiAnalysisOptions
): Promise<ApiAnalysisResult> {
  const { rootPath, skipDirs = SKIP_DIRS, verbose = false } = options;
  
  // Get all source files
  let files = options.filePaths 
    ? options.filePaths.map(f => path.resolve(rootPath, f))
    : await getSourceFiles(rootPath, skipDirs);
  
  if (verbose) {
    process.stderr.write(`[api] Analyzing ${files.length} source files for Node.js API usage\n`);
  }
  
  // Analyze each file
  const usageByModule = new Map<string, ModuleUsageInfo>();
  let totalImports = 0;
  
  for (const filePath of files) {
    const imports = await analyzeFile(filePath, rootPath);
    const relativePath = path.relative(rootPath, filePath);
    
    for (const imp of imports) {
      totalImports++;
      
      const modulePath = imp.modulePath;
      const existing = usageByModule.get(modulePath);
      
      const fileInfo = {
        path: relativePath,
        line: imp.line,
        importType: imp.importType,
        hasNodePrefix: imp.hasNodePrefix,
      };
      
      if (existing) {
        existing.files.push(fileInfo);
      } else {
        const moduleInfo = getNodeModule(modulePath);
        usageByModule.set(modulePath, {
          module: modulePath,
          category: moduleInfo?.category || 'green',
          files: [fileInfo],
          recommendsPrefix: moduleInfo?.recommendsPrefix ?? true,
          bunAlternatives: moduleInfo?.bunAlternatives,
          notes: moduleInfo?.notes,
        });
      }
    }
  }
  
  // Categorize modules
  const greenZone: string[] = [];
  const yellowZone: string[] = [];
  const redZone: string[] = [];
  const withoutNodePrefix: string[] = [];
  
  for (const [modulePath, info] of usageByModule) {
    if (info.category === 'green') {
      greenZone.push(modulePath);
    } else if (info.category === 'yellow') {
      yellowZone.push(modulePath);
    } else if (info.category === 'red') {
      redZone.push(modulePath);
    }
    
    // Check for missing node: prefix
    if (info.recommendsPrefix && !hasNodePrefix(modulePath)) {
      const hasAnyWithPrefix = info.files.some(f => f.hasNodePrefix);
      if (!hasAnyWithPrefix) {
        withoutNodePrefix.push(modulePath);
      }
    }
  }
  
  // Generate findings
  const findings: Finding[] = [];
  
  // Finding: Node.js built-in usage summary
  if (usageByModule.size > 0) {
    const details: string[] = [];
    const hints: string[] = [];
    
    // Group by category
    if (greenZone.length > 0) {
      details.push(`**Green Zone** (${greenZone.length} modules):`);
      for (const mod of stableSort(greenZone, x => x)) {
        const info = usageByModule.get(mod);
        const fileCount = info?.files.length || 0;
        details.push(`  - ${mod} (${fileCount} files)`);
      }
    }
    
    if (yellowZone.length > 0) {
      details.push(`**Yellow Zone** (${yellowZone.length} modules):`);
      for (const mod of stableSort(yellowZone, x => x)) {
        const info = usageByModule.get(mod);
        const fileCount = info?.files.length || 0;
        const notes = info?.notes ? ` - ${info.notes}` : '';
        details.push(`  - ${mod} (${fileCount} files)${notes}`);
      }
      hints.push('Yellow zone modules work in Bun but may have behavior differences.');
      hints.push('Test code using these modules carefully after migration.');
    }
    
    if (redZone.length > 0) {
      details.push(`**Red Zone** (${redZone.length} modules):`);
      for (const mod of stableSort(redZone, x => x)) {
        const info = usageByModule.get(mod);
        const fileCount = info?.files.length || 0;
        const notes = info?.notes ? ` - ${info.notes}` : '';
        const alternatives = info?.bunAlternatives ? ` (alternatives: ${info.bunAlternatives.join(', ')})` : '';
        details.push(`  - ${mod} (${fileCount} files)${notes}${alternatives}`);
      }
      hints.push('Red zone modules have limited or no support in Bun.');
      hints.push('Consider alternatives or conditional code paths.');
    }
    
    // Determine severity based on categories present
    let severity: 'green' | 'yellow' | 'red' = 'green';
    if (redZone.length > 0) {
      severity = 'red';
    } else if (yellowZone.length > 0) {
      severity = 'yellow';
    }
    
    findings.push({
      id: 'api.node_builtins',
      title: `Node.js built-in modules detected: ${usageByModule.size} modules`,
      severity,
      details,
      hints: hints.length > 0 ? hints : ['Most Node.js APIs work identically in Bun.'],
    });
  }
  
  // Finding: Missing node: prefix
  if (withoutNodePrefix.length > 0) {
    const details: string[] = [];
    details.push('Modules without `node:` prefix:');
    
    for (const mod of stableSort(withoutNodePrefix, x => x)) {
      const info = usageByModule.get(mod);
      const files = info?.files.slice(0, 3) || [];
      details.push(`  - ${mod}`);
      for (const f of files) {
        details.push(`    ${f.path}:${f.line}`);
      }
      if ((info?.files.length || 0) > 3) {
        details.push(`    ... and ${(info?.files.length || 0) - 3} more`);
      }
    }
    
    findings.push({
      id: 'api.node_prefix',
      title: 'Consider using `node:` prefix for Node.js built-ins',
      severity: 'green',
      details,
      hints: [
        'The `node:` prefix makes it explicit that you\'re using Node.js APIs.',
        'This improves code clarity and future-proofs for changes.',
        'Example: `import { readFileSync } from \'node:fs\'`',
      ],
    });
  }
  
  return {
    findings,
    usageByModule,
    summary: {
      totalFiles: files.length,
      totalImports,
      greenZone: stableSort(greenZone, x => x),
      yellowZone: stableSort(yellowZone, x => x),
      redZone: stableSort(redZone, x => x),
      withoutNodePrefix: stableSort(withoutNodePrefix, x => x),
    },
  };
}
