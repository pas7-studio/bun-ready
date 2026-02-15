/**
 * ESM/CJS Module Analysis
 * 
 * Analyzes source code for module system patterns,
 * detects mixed ESM/CJS usage, and CJS globals
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Finding } from './types.js';
import { 
  parseModuleInfo, 
  parseCJSGlobals,
  type ModuleInfo,
  type CJSGlobalUsage,
} from './import_parser.js';
import { 
  CJS_GLOBALS,
  CJSGlobalInfo,
  CJS_GLOBAL_NAMES,
} from './node_builtins.js';
import { stableSort } from './util.js';

// Source file extensions to analyze
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.tsx', '.jsx', '.mts', '.mjs', '.cts', '.cjs']);

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next', '.nuxt']);

/**
 * File with mixed imports
 */
export interface MixedImportFile {
  path: string;
  esmImportLines: number[];
  cjsRequireLines: number[];
}

/**
 * Result of module system analysis
 */
export interface ModuleAnalysisResult {
  /** All findings generated */
  findings: Finding[];
  /** Summary statistics */
  summary: {
    totalFiles: number;
    esmFiles: number;
    cjsFiles: number;
    mixedFiles: number;
    cjsGlobalsUsage: number;
  };
  /** Categorized files */
  files: {
    esm: string[];
    cjs: string[];
    mixed: MixedImportFile[];
  };
  /** CJS globals usage details */
  cjsGlobals: Array<{
    global: string;
    file: string;
    line: number;
    context?: string;
    replacement?: string;
  }>;
}

/**
 * Options for module analysis
 */
export interface ModuleAnalysisOptions {
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
 * Analyze a single file for module patterns
 */
async function analyzeFile(
  filePath: string,
  rootPath: string
): Promise<ModuleInfo> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseModuleInfo(content, path.relative(rootPath, filePath));
  } catch {
    return {
      file: path.relative(rootPath, filePath),
      extension: path.extname(filePath),
      imports: [],
      cjsGlobals: [],
      hasEsmImports: false,
      hasCjsRequires: false,
      hasEsmExports: false,
      hasCjsExports: false,
      moduleType: 'unknown',
    };
  }
}

/**
 * Analyze ESM/CJS module patterns in a project
 */
export async function analyzeModuleSystem(
  options: ModuleAnalysisOptions
): Promise<ModuleAnalysisResult> {
  const { rootPath, skipDirs = SKIP_DIRS, verbose = false } = options;
  
  // Get all source files
  let files = options.filePaths 
    ? options.filePaths.map(f => path.resolve(rootPath, f))
    : await getSourceFiles(rootPath, skipDirs);
  
  if (verbose) {
    process.stderr.write(`[modules] Analyzing ${files.length} source files for ESM/CJS patterns\n`);
  }
  
  // Analyze each file
  const moduleInfos: ModuleInfo[] = [];
  
  for (const filePath of files) {
    const info = await analyzeFile(filePath, rootPath);
    moduleInfos.push(info);
  }
  
  // Categorize files
  const esmFiles: string[] = [];
  const cjsFiles: string[] = [];
  const mixedFiles: MixedImportFile[] = [];
  const allCjsGlobals: Array<{
    global: string;
    file: string;
    line: number;
    context?: string;
    replacement?: string;
  }> = [];
  
  for (const info of moduleInfos) {
    if (info.moduleType === 'esm') {
      esmFiles.push(info.file);
    } else if (info.moduleType === 'cjs') {
      cjsFiles.push(info.file);
    } else if (info.moduleType === 'mixed') {
      mixedFiles.push({
        path: info.file,
        esmImportLines: info.imports
          .filter(i => i.importType !== 'cjs')
          .map(i => i.line),
        cjsRequireLines: info.imports
          .filter(i => i.importType === 'cjs')
          .map(i => i.line),
      });
    }
    
    // Collect CJS globals usage
    for (const usage of info.cjsGlobals) {
      const globalInfo = CJS_GLOBALS.find(g => g.name === usage.global);
      allCjsGlobals.push({
        global: usage.global,
        file: info.file,
        line: usage.line,
        context: usage.context,
        replacement: globalInfo?.esmReplacement,
      });
    }
  }
  
  // Generate findings
  const findings: Finding[] = [];
  
  // Finding: Mixed ESM/CJS imports
  if (mixedFiles.length > 0) {
    const details: string[] = [];
    const hints: string[] = [];
    
    details.push(`Found ${mixedFiles.length} file(s) with mixed ESM/CJS imports:`);
    details.push('');
    
    const sortedMixed = stableSort(mixedFiles, x => x.path);
    for (const mixed of sortedMixed.slice(0, 10)) {  // Show max 10 files
      details.push(`**${mixed.path}**`);
      if (mixed.esmImportLines.length > 0) {
        details.push(`  - ESM imports on lines: ${mixed.esmImportLines.join(', ')}`);
      }
      if (mixed.cjsRequireLines.length > 0) {
        details.push(`  - CJS requires on lines: ${mixed.cjsRequireLines.join(', ')}`);
      }
    }
    
    if (mixedFiles.length > 10) {
      details.push(`... and ${mixedFiles.length - 10} more files`);
    }
    
    hints.push('Bun supports both ESM and CJS modules.');
    hints.push('However, mixing them in the same file can cause issues with some bundlers.');
    hints.push('Consider standardizing on ESM for better compatibility.');
    
    findings.push({
      id: 'modules.esm_cjs_mixed',
      title: 'Mixed ESM/CJS imports detected',
      severity: 'yellow',
      details,
      hints,
    });
  }
  
  // Finding: CJS globals usage
  if (allCjsGlobals.length > 0) {
    const details: string[] = [];
    const hints: string[] = [];
    
    // Group by global name
    const byGlobal = new Map<string, typeof allCjsGlobals>();
    for (const usage of allCjsGlobals) {
      const existing = byGlobal.get(usage.global) || [];
      existing.push(usage);
      byGlobal.set(usage.global, existing);
    }
    
    details.push(`Found CJS globals that may not work in ESM context:`);
    details.push('');
    
    for (const [global, usages] of byGlobal) {
      const globalInfo = CJS_GLOBALS.find(g => g.name === global);
      details.push(`**${global}** (${usages.length} occurrences):`);
      
      const sortedUsages = stableSort(usages, u => `${u.file}:${u.line}`);
      for (const usage of sortedUsages.slice(0, 5)) {  // Show max 5 per global
        details.push(`  - ${usage.file}:${usage.line}`);
      }
      if (usages.length > 5) {
        details.push(`  - ... and ${usages.length - 5} more`);
      }
      
      if (globalInfo) {
        details.push(`  - Replace with: \`${globalInfo.esmReplacement}\``);
        if (globalInfo.notes) {
          details.push(`  - Note: ${globalInfo.notes}`);
        }
      }
      details.push('');
    }
    
    hints.push('Replace __dirname with import.meta.dirname (available in Bun and Node 20.11+)');
    hints.push('Replace __filename with import.meta.url (use fileURLToPath for path)');
    hints.push('Replace require.main === module with import.meta.main');
    
    findings.push({
      id: 'modules.cjs_globals',
      title: 'CJS-specific globals detected',
      severity: 'yellow',
      details,
      hints,
    });
  }
  
  return {
    findings,
    summary: {
      totalFiles: files.length,
      esmFiles: esmFiles.length,
      cjsFiles: cjsFiles.length,
      mixedFiles: mixedFiles.length,
      cjsGlobalsUsage: allCjsGlobals.length,
    },
    files: {
      esm: stableSort(esmFiles, x => x),
      cjs: stableSort(cjsFiles, x => x),
      mixed: stableSort(mixedFiles, x => x.path),
    },
    cjsGlobals: stableSort(allCjsGlobals, x => `${x.file}:${x.line}`),
  };
}

/**
 * Get replacement info for a CJS global
 */
export function getCJSGlobalReplacement(globalName: string): CJSGlobalInfo | undefined {
  return CJS_GLOBALS.find(g => g.name === globalName);
}
