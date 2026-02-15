/**
 * Import Parser Utilities
 * 
 * Parses import/require statements from source code
 * to detect Node.js built-in usage and module patterns
 */

export type ImportType = 'esm-named' | 'esm-default' | 'esm-namespace' | 'esm-dynamic' | 'cjs';

export interface ParsedImport {
  /** The module path being imported */
  modulePath: string;
  /** Type of import */
  importType: ImportType;
  /** Named imports (for esm-named) */
  namedImports?: string[];
  /** Has node: prefix */
  hasNodePrefix: boolean;
  /** Line number in file */
  line: number;
  /** Original import statement */
  raw: string;
}

export interface CJSGlobalUsage {
  /** Global name (__dirname, __filename, etc.) */
  global: string;
  /** Line number */
  line: number;
  /** Context snippet */
  context?: string;
}

export interface ModuleInfo {
  /** File path */
  file: string;
  /** File extension */
  extension: string;
  /** All imports found */
  imports: ParsedImport[];
  /** CJS globals usage */
  cjsGlobals: CJSGlobalUsage[];
  /** Has ESM imports */
  hasEsmImports: boolean;
  /** Has CJS requires */
  hasCjsRequires: boolean;
  /** Has ESM exports */
  hasEsmExports: boolean;
  /** Has CJS exports (module.exports, exports.xxx) */
  hasCjsExports: boolean;
  /** Determined module type */
  moduleType: 'esm' | 'cjs' | 'mixed' | 'unknown';
}

// Regex patterns for import detection

/** ESM named import: import { x, y } from 'module' */
const ESM_NAMED_REGEX = /import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;

/** ESM default import: import x from 'module' */
const ESM_DEFAULT_REGEX = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

/** ESM namespace import: import * as x from 'module' */
const ESM_NAMESPACE_REGEX = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

/** Dynamic import: import('module') or import("module") */
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** CJS require: require('module') or require("module") */
const CJS_REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** ESM export: export ... */
const ESM_EXPORT_REGEX = /^export\s+/gm;

/** CJS module.exports: module.exports = ... */
const CJS_MODULE_EXPORTS_REGEX = /module\.exports\s*=/g;

/** CJS exports.xxx: exports.foo = ... */
const CJS_EXPORTS_REGEX = /exports\.\w+\s*=/g;

/** __dirname usage */
const DIRNAME_REGEX = /__dirname/g;

/** __filename usage */
const FILENAME_REGEX = /__filename/g;

/** require.main usage */
const REQUIRE_MAIN_REGEX = /require\.main/g;

/** require.cache usage */
const REQUIRE_CACHE_REGEX = /require\.cache/g;

/** Clean regex state by resetting lastIndex */
function resetRegex(regex: RegExp): void {
  regex.lastIndex = 0;
}

/**
 * Parse all imports from source code
 */
export function parseImports(content: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const lines = content.split('\n');
  
  // Reset all regex states
  resetRegex(ESM_NAMED_REGEX);
  resetRegex(ESM_DEFAULT_REGEX);
  resetRegex(ESM_NAMESPACE_REGEX);
  resetRegex(DYNAMIC_IMPORT_REGEX);
  resetRegex(CJS_REQUIRE_REGEX);
  
  // Parse ESM named imports
  let match: RegExpExecArray | null;
  while ((match = ESM_NAMED_REGEX.exec(content)) !== null) {
    const namedPart = match[1];
    const modulePath = match[2];
    if (!namedPart || !modulePath) continue;
    
    const namedImports = namedPart
      .split(',')
      .map(s => s.trim().split(/\s+as\s+/)[0]?.trim() || '')
      .filter(s => s.length > 0);
    
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    imports.push({
      modulePath,
      importType: 'esm-named',
      namedImports,
      hasNodePrefix: modulePath.startsWith('node:'),
      line: lineNumber,
      raw: match[0],
    });
  }
  
  // Parse ESM default imports
  while ((match = ESM_DEFAULT_REGEX.exec(content)) !== null) {
    const moduleName = match[1];
    const modulePath = match[2];
    if (!moduleName || !modulePath) continue;
    
    // Skip if already captured as named import
    if (imports.some(i => i.modulePath === modulePath && i.line === content.substring(0, match!.index).split('\n').length)) {
      continue;
    }
    
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    imports.push({
      modulePath,
      importType: 'esm-default',
      hasNodePrefix: modulePath.startsWith('node:'),
      line: lineNumber,
      raw: match[0],
    });
  }
  
  // Parse ESM namespace imports
  while ((match = ESM_NAMESPACE_REGEX.exec(content)) !== null) {
    const modulePath = match[2];
    if (!modulePath) continue;
    
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    imports.push({
      modulePath,
      importType: 'esm-namespace',
      hasNodePrefix: modulePath.startsWith('node:'),
      line: lineNumber,
      raw: match[0],
    });
  }
  
  // Parse dynamic imports
  while ((match = DYNAMIC_IMPORT_REGEX.exec(content)) !== null) {
    const modulePath = match[1];
    if (!modulePath) continue;
    
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    imports.push({
      modulePath,
      importType: 'esm-dynamic',
      hasNodePrefix: modulePath.startsWith('node:'),
      line: lineNumber,
      raw: match[0],
    });
  }
  
  // Parse CJS requires
  while ((match = CJS_REQUIRE_REGEX.exec(content)) !== null) {
    const modulePath = match[1];
    if (!modulePath) continue;
    
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    imports.push({
      modulePath,
      importType: 'cjs',
      hasNodePrefix: modulePath.startsWith('node:'),
      line: lineNumber,
      raw: match[0],
    });
  }
  
  // Sort by line number and deduplicate
  return imports
    .sort((a, b) => a.line - b.line)
    .filter((imp, idx, arr) => 
      arr.findIndex(i => i.modulePath === imp.modulePath && i.line === imp.line) === idx
    );
}

/**
 * Parse CJS globals usage from source code
 */
export function parseCJSGlobals(content: string): CJSGlobalUsage[] {
  const usages: CJSGlobalUsage[] = [];
  const lines = content.split('\n');
  
  const globalsToCheck = [
    { name: '__dirname', regex: DIRNAME_REGEX },
    { name: '__filename', regex: FILENAME_REGEX },
    { name: 'require.main', regex: REQUIRE_MAIN_REGEX },
    { name: 'require.cache', regex: REQUIRE_CACHE_REGEX },
  ];
  
  for (const { name, regex } of globalsToCheck) {
    resetRegex(regex);
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const lineContent = lines[lineNumber - 1]?.trim() || '';
      
      usages.push({
        global: name,
        line: lineNumber,
        context: lineContent,
      });
    }
  }
  
  return usages.sort((a, b) => a.line - b.line);
}

/**
 * Check for ESM exports
 */
export function hasEsmExports(content: string): boolean {
  resetRegex(ESM_EXPORT_REGEX);
  return ESM_EXPORT_REGEX.test(content);
}

/**
 * Check for CJS exports
 */
export function hasCjsExports(content: string): boolean {
  resetRegex(CJS_MODULE_EXPORTS_REGEX);
  resetRegex(CJS_EXPORTS_REGEX);
  return CJS_MODULE_EXPORTS_REGEX.test(content) || CJS_EXPORTS_REGEX.test(content);
}

/**
 * Parse a single file and extract all module information
 */
export function parseModuleInfo(content: string, filePath: string): ModuleInfo {
  const imports = parseImports(content);
  const cjsGlobals = parseCJSGlobals(content);
  
  const esmImports = imports.some(i =>
    i.importType === 'esm-named' ||
    i.importType === 'esm-default' ||
    i.importType === 'esm-namespace' ||
    i.importType === 'esm-dynamic'
  );
  
  const cjsRequires = imports.some(i => i.importType === 'cjs');
  const esmExports = hasEsmExports(content);
  const cjsExports = hasCjsExports(content);
  
  // Determine module type
  let moduleType: 'esm' | 'cjs' | 'mixed' | 'unknown' = 'unknown';
  
  if (esmImports || esmExports) {
    if (cjsRequires || cjsExports) {
      moduleType = 'mixed';
    } else {
      moduleType = 'esm';
    }
  } else if (cjsRequires || cjsExports) {
    moduleType = 'cjs';
  }
  
  // Get extension
  const extension = filePath.split('.').pop() || '';
  
  return {
    file: filePath,
    extension,
    imports,
    cjsGlobals,
    hasEsmImports: esmImports,
    hasCjsRequires: cjsRequires,
    hasEsmExports: esmExports,
    hasCjsExports: cjsExports,
    moduleType,
  };
}

/**
 * Filter imports to only Node.js built-in modules
 */
export function filterNodeBuiltinImports(
  imports: ParsedImport[], 
  isBuiltin: (path: string) => boolean
): ParsedImport[] {
  return imports.filter(imp => isBuiltin(imp.modulePath));
}

/**
 * Group imports by module path
 */
export function groupImportsByModule(imports: ParsedImport[]): Map<string, ParsedImport[]> {
  const grouped = new Map<string, ParsedImport[]>();
  
  for (const imp of imports) {
    const existing = grouped.get(imp.modulePath) || [];
    existing.push(imp);
    grouped.set(imp.modulePath, existing);
  }
  
  return grouped;
}

/**
 * Get unique module paths from imports
 */
export function getUniqueModulePaths(imports: ParsedImport[]): string[] {
  return [...new Set(imports.map(i => i.modulePath))].sort();
}

/**
 * Count imports by type
 */
export function countImportsByType(imports: ParsedImport[]): Record<ImportType, number> {
  const counts: Record<ImportType, number> = {
    'esm-named': 0,
    'esm-default': 0,
    'esm-namespace': 0,
    'esm-dynamic': 0,
    'cjs': 0,
  };
  
  for (const imp of imports) {
    counts[imp.importType]++;
  }
  
  return counts;
}
