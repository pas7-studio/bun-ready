/**
 * Node.js Built-in Modules Database for Bun Compatibility Analysis
 * 
 * This file contains the classification of Node.js built-in modules
 * based on their compatibility with Bun runtime.
 */

export type ModuleCategory = 'green' | 'yellow' | 'red';

export interface NodeModule {
  /** Module name (e.g., 'fs', 'node:fs', 'fs/promises') */
  name: string;
  /** Compatibility category */
  category: ModuleCategory;
  /** Additional notes about compatibility */
  notes?: string;
  /** Bun-native alternatives if available */
  bunAlternatives?: string[];
  /** Whether this module requires node: prefix for best compatibility */
  recommendsPrefix?: boolean;
}

/**
 * Green Zone - Fully compatible with Bun
 * These modules work identically or near-identically in Bun
 */
const GREEN_ZONE_MODULES: NodeModule[] = [
  // File System
  { name: 'fs', category: 'green', recommendsPrefix: true },
  { name: 'fs/promises', category: 'green', recommendsPrefix: true },
  { name: 'node:fs', category: 'green' },
  { name: 'node:fs/promises', category: 'green' },
  
  // Path
  { name: 'path', category: 'green', recommendsPrefix: true },
  { name: 'path/posix', category: 'green', recommendsPrefix: true },
  { name: 'path/win32', category: 'green', recommendsPrefix: true },
  { name: 'node:path', category: 'green' },
  
  // URL and Utilities
  { name: 'url', category: 'green', recommendsPrefix: true },
  { name: 'util', category: 'green', recommendsPrefix: true },
  { name: 'util/types', category: 'green', recommendsPrefix: true },
  { name: 'node:url', category: 'green' },
  { name: 'node:util', category: 'green' },
  
  // Events and Streams
  { name: 'events', category: 'green', recommendsPrefix: true },
  { name: 'stream', category: 'green', recommendsPrefix: true },
  { name: 'stream/promises', category: 'green', recommendsPrefix: true },
  { name: 'stream/web', category: 'green', recommendsPrefix: true },
  { name: 'node:events', category: 'green' },
  { name: 'node:stream', category: 'green' },
  
  // Crypto
  { name: 'crypto', category: 'green', recommendsPrefix: true },
  { name: 'node:crypto', category: 'green' },
  
  // Buffer and Encoding
  { name: 'buffer', category: 'green', recommendsPrefix: true },
  { name: 'string_decoder', category: 'green', recommendsPrefix: true },
  { name: 'node:buffer', category: 'green' },
  
  // Query String
  { name: 'querystring', category: 'green', recommendsPrefix: true },
  { name: 'node:querystring', category: 'green' },
  
  // OS and System
  { name: 'os', category: 'green', recommendsPrefix: true },
  { name: 'node:os', category: 'green' },
  
  // DNS
  { name: 'dns', category: 'green', recommendsPrefix: true },
  { name: 'dns/promises', category: 'green', recommendsPrefix: true },
  { name: 'node:dns', category: 'green' },
  
  // Console and Process
  { name: 'console', category: 'green' },
  { name: 'process', category: 'green' },
  { name: 'node:process', category: 'green' },
  
  // Assert
  { name: 'assert', category: 'green', recommendsPrefix: true },
  { name: 'assert/strict', category: 'green', recommendsPrefix: true },
  { name: 'node:assert', category: 'green' },
  
  // Constants
  { name: 'constants', category: 'green' },
  { name: 'node:constants', category: 'green' },
  
  // Timers
  { name: 'timers', category: 'green', recommendsPrefix: true },
  { name: 'timers/promises', category: 'green', recommendsPrefix: true },
  { name: 'node:timers', category: 'green' },
  
  // readline
  { name: 'readline', category: 'green', recommendsPrefix: true },
  { name: 'readline/promises', category: 'green', recommendsPrefix: true },
  { name: 'node:readline', category: 'green' },
];

/**
 * Yellow Zone - Partial compatibility or behavior differences
 * These modules work but may have subtle differences or have Bun alternatives
 */
const YELLOW_ZONE_MODULES: NodeModule[] = [
  // Child Process
  { 
    name: 'child_process', 
    category: 'yellow', 
    notes: 'spawn and exec work, but signal handling may differ slightly',
    recommendsPrefix: true 
  },
  { name: 'node:child_process', category: 'yellow', notes: 'spawn behavior differs slightly in Bun' },
  
  // HTTP - works but Bun has native alternative
  { 
    name: 'http', 
    category: 'yellow', 
    bunAlternatives: ['Bun.serve'],
    recommendsPrefix: true 
  },
  { 
    name: 'https', 
    category: 'yellow', 
    bunAlternatives: ['Bun.serve'],
    recommendsPrefix: true 
  },
  { name: 'node:http', category: 'yellow', bunAlternatives: ['Bun.serve'] },
  { name: 'node:https', category: 'yellow', bunAlternatives: ['Bun.serve'] },
  
  // HTTP2
  { name: 'http2', category: 'yellow', recommendsPrefix: true },
  { name: 'node:http2', category: 'yellow' },
  
  // Net
  { name: 'net', category: 'yellow', recommendsPrefix: true },
  { name: 'node:net', category: 'yellow' },
  
  // Worker Threads - different API in Bun
  { 
    name: 'worker_threads', 
    category: 'yellow', 
    notes: 'Bun uses different Worker API (Bun.Worker is not available, use Worker from node:worker_threads)',
    recommendsPrefix: true 
  },
  { name: 'node:worker_threads', category: 'yellow', notes: 'Works but Bun has different threading model' },
  
  // Zlib
  { name: 'zlib', category: 'yellow', recommendsPrefix: true },
  { name: 'node:zlib', category: 'yellow' },
  
  // TLS
  { name: 'tls', category: 'yellow', notes: 'Most features work, some cert options may differ', recommendsPrefix: true },
  { name: 'node:tls', category: 'yellow' },
  
  // Performance Hooks
  { name: 'perf_hooks', category: 'yellow', recommendsPrefix: true },
  { name: 'node:perf_hooks', category: 'yellow' },
  
  // Async Hooks - limited support
  { 
    name: 'async_hooks', 
    category: 'yellow', 
    notes: 'Limited support in Bun - some hooks may not fire',
    recommendsPrefix: true 
  },
  { name: 'node:async_hooks', category: 'yellow', notes: 'Limited support in Bun' },
  
  // Cluster
  { name: 'cluster', category: 'yellow', recommendsPrefix: true },
  { name: 'node:cluster', category: 'yellow' },
  
  // Dgram (UDP)
  { name: 'dgram', category: 'yellow', recommendsPrefix: true },
  { name: 'node:dgram', category: 'yellow' },
  
  // Punycode (deprecated but still available)
  { name: 'punycode', category: 'yellow', notes: 'Deprecated in Node.js' },
  { name: 'node:punycode', category: 'yellow', notes: 'Deprecated' },
  
  // Domain (deprecated)
  { name: 'domain', category: 'yellow', notes: 'Deprecated in Node.js' },
  { name: 'node:domain', category: 'yellow', notes: 'Deprecated' },
];

/**
 * Red Zone - Limited or no support, requires attention
 * These modules may not work correctly or at all in Bun
 */
const RED_ZONE_MODULES: NodeModule[] = [
  // VM - limited support
  { 
    name: 'vm', 
    category: 'red', 
    notes: 'Limited support in Bun - consider using isolated-vm or other alternatives',
    bunAlternatives: ['isolated-vm', 'vm2 (deprecated)']
  },
  { 
    name: 'vm/promises', 
    category: 'red', 
    notes: 'Limited support in Bun'
  },
  { name: 'node:vm', category: 'red', notes: 'Limited support in Bun' },
  
  // V8 - not applicable to Bun (uses JavaScriptCore)
  { 
    name: 'v8', 
    category: 'red', 
    notes: 'Not applicable - Bun uses JavaScriptCore, not V8',
    bunAlternatives: ['None - V8-specific APIs unavailable']
  },
  { 
    name: 'v8/tools', 
    category: 'red', 
    notes: 'V8-specific, not available in Bun'
  },
  { name: 'node:v8', category: 'red', notes: 'Not applicable - Bun uses JavaScriptCore' },
  
  // Inspector - different API
  { 
    name: 'inspector', 
    category: 'red', 
    notes: 'Different API in Bun - debugger integration differs'
  },
  { name: 'node:inspector', category: 'red', notes: 'Different API in Bun' },
  { name: 'node:inspector/promises', category: 'red', notes: 'Different API in Bun' },
  
  // WASI - experimental
  { 
    name: 'wasi', 
    category: 'red', 
    notes: 'Experimental support in Bun - may not work correctly'
  },
  { name: 'node:wasi', category: 'red', notes: 'Experimental in Bun' },
  
  // REPL - implementation differences
  { 
    name: 'repl', 
    category: 'red', 
    notes: 'Implementation differs in Bun - use bun repl instead'
  },
  { name: 'node:repl', category: 'red', notes: 'Different implementation' },
  
  // Trace Events - not available
  { 
    name: 'trace_events', 
    category: 'red', 
    notes: 'Not available in Bun'
  },
  { name: 'node:trace_events', category: 'red', notes: 'Not available' },
];

/**
 * All Node.js built-in modules with their compatibility info
 */
export const NODE_MODULES: NodeModule[] = [
  ...GREEN_ZONE_MODULES,
  ...YELLOW_ZONE_MODULES,
  ...RED_ZONE_MODULES,
];

/**
 * Map of module name to module info for quick lookup
 */
export const NODE_MODULES_MAP: Map<string, NodeModule> = new Map(
  NODE_MODULES.map(m => [m.name, m])
);

/**
 * Get module info by name
 */
export function getNodeModule(name: string): NodeModule | undefined {
  return NODE_MODULES_MAP.get(name);
}

/**
 * Check if a module name is a Node.js built-in
 */
export function isNodeBuiltin(name: string): boolean {
  // Check direct match
  if (NODE_MODULES_MAP.has(name)) {
    return true;
  }
  
  // Check without node: prefix
  if (name.startsWith('node:')) {
    return true;
  }
  
  // Check if it's a known built-in without prefix
  const unprefixed = name.replace(/^node:/, '');
  return NODE_MODULES_MAP.has(unprefixed);
}

/**
 * Get the base module name (without node: prefix or subpath)
 */
export function getBaseModuleName(name: string): string {
  // Remove node: prefix
  let base = name.replace(/^node:/, '');
  // Keep subpath for modules like fs/promises
  return base;
}

/**
 * Check if a module has the node: prefix
 */
export function hasNodePrefix(name: string): boolean {
  return name.startsWith('node:');
}

/**
 * Get module category
 */
export function getModuleCategory(name: string): ModuleCategory | undefined {
  const module = getNodeModule(name);
  if (module) {
    return module.category;
  }
  // Try without prefix
  const unprefixed = name.replace(/^node:/, '');
  const unprefixedModule = getNodeModule(unprefixed);
  return unprefixedModule?.category;
}

/**
 * Get all modules in a category
 */
export function getModulesByCategory(category: ModuleCategory): NodeModule[] {
  return NODE_MODULES.filter(m => m.category === category);
}

/**
 * Simple list of built-in module names (without node: prefix)
 * Used for quick import detection
 */
export const NODE_BUILTIN_NAMES: Set<string> = new Set([
  // Green zone
  'fs', 'fs/promises', 'path', 'path/posix', 'path/win32',
  'url', 'util', 'util/types', 'events', 'stream', 'stream/promises', 'stream/web',
  'crypto', 'buffer', 'string_decoder', 'querystring', 'os', 'dns', 'dns/promises',
  'console', 'process', 'assert', 'assert/strict', 'constants', 'timers', 'timers/promises',
  'readline', 'readline/promises',
  
  // Yellow zone
  'child_process', 'http', 'https', 'http2', 'net', 'worker_threads',
  'zlib', 'tls', 'perf_hooks', 'async_hooks', 'cluster', 'dgram', 'punycode', 'domain',
  
  // Red zone
  'vm', 'vm/promises', 'v8', 'v8/tools', 'inspector', 'wasi', 'repl', 'trace_events',
]);

/**
 * Check if an import path is a Node.js built-in module
 */
export function isNodeBuiltinImport(importPath: string): boolean {
  // Check for node: prefix
  if (importPath.startsWith('node:')) {
    return true;
  }
  
  // Check direct match
  if (NODE_BUILTIN_NAMES.has(importPath)) {
    return true;
  }
  
  // Check base name (for nested paths like fs/promises)
  const baseName = importPath.split('/')[0];
  if (baseName && NODE_BUILTIN_NAMES.has(baseName)) {
    return true;
  }
  
  return false;
}

/**
 * CJS globals that don't work in ESM context
 */
export interface CJSGlobalInfo {
  name: string;
  esmReplacement: string;
  notes: string;
  fallback?: string;
}

export const CJS_GLOBALS: CJSGlobalInfo[] = [
  {
    name: '__dirname',
    esmReplacement: 'import.meta.dirname',
    notes: 'Available in Node 20.11+ and Bun natively',
    fallback: "new URL('.', import.meta.url).pathname",
  },
  {
    name: '__filename',
    esmReplacement: 'import.meta.url',
    notes: 'Returns URL string, use fileURLToPath for path',
    fallback: "new URL(import.meta.url).pathname",
  },
  {
    name: 'require.main',
    esmReplacement: 'import.meta.main',
    notes: 'Bun-specific, checks if current file is entry point',
  },
  {
    name: 'require.cache',
    esmReplacement: 'N/A',
    notes: 'No direct ESM equivalent - module caching works differently',
  },
  {
    name: 'module.exports',
    esmReplacement: 'export default',
    notes: 'Use named exports or export default instead',
  },
  {
    name: 'exports',
    esmReplacement: 'export',
    notes: 'Use named exports instead',
  },
];

export const CJS_GLOBAL_NAMES: Set<string> = new Set(
  CJS_GLOBALS.map(g => g.name)
);

/**
 * Get CJS global info by name
 */
export function getCJSGlobal(name: string): CJSGlobalInfo | undefined {
  return CJS_GLOBALS.find(g => g.name === name);
}
