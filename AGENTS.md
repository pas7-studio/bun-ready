# Agent Rules (for AI coding agents)

This repository is designed to be edited by humans and AI agents safely.

## Non-negotiables
- Do not add "magic" behavior that edits user repositories.
- Keep output deterministic (stable ordering, consistent formatting).
- No network calls in tests. Tests must be fast and offline.
- No heavy dependencies for the MVP.

## Workflow
1) Make small, reviewable changes.
2) Add/adjust tests for each behavior change.
3) Ensure:
   - `bun test`
   - `bun run check`
   - `bun run build`

## CLI contract (v0.x)
- Default output is Markdown.
- JSON output is allowed but must be additive (no breaking fields in v0.x).
- Exit codes: 0 green, 2 yellow, 3 red (keep stable).

## Report philosophy
- "Green" means: bun dry-run install succeeded AND no high-risk signals.
- "Yellow" means: migration likely works but expect manual fixes.
- "Red" means: bun install dry-run failed OR strong native-addon / lifecycle issues likely to break.

## Style
- TypeScript strict
- Avoid `any`
- Keep code readable; prefer clear types over cleverness

## New Rules for v0.2

### Finding IDs

All finding IDs must be documented and stable across versions:

| ID | Description | Severity |
|----|-------------|-----------|
| `scripts.lifecycle` | Lifecycle scripts in root project | yellow |
| `scripts.npm_specific` | npm/yarn/pnpm-specific commands | yellow |
| `scripts.pm_assumptions` | Package manager assumptions | yellow |
| `deps.native_addons` | Native addon dependencies | yellow/red |
| `runtime.node_version` | Node version < 18 | yellow |
| `runtime.dev_tools` | Dev tools (jest, vitest, etc.) | yellow |
| `runtime.build_tools` | Build tools (webpack, babel, etc.) | yellow |
| `runtime.ts_execution` | TS runtime execution (ts-node, tsx) | yellow |
| `lockfile.missing` | No lockfile found | yellow |
| `lockfile.migration` | Non-Bun lockfile | yellow |
| `install.blocked_scripts` | Scripts blocked by Bun | red |
| `install.trusted_deps` | Trusted dependencies mentioned | yellow |
| `repo.no_package_json` | Missing package.json | red |

When adding new finding IDs:
1. Document in AGENTS.md
2. Add to the table above
3. Ensure stable behavior across versions
4. Provide actionable hints

### Monorepo Handling

- Always test with both single packages and monorepos
- Verify workspace discovery works for all patterns (*, **)
- Test --scope flags (root, packages, all)
- Ensure deterministic ordering of packages in reports
- Never modify user repositories (only read)

## Package Usage Analysis

### Supported Import Types

The usage analyzer supports the following import patterns:

1. **ES6 Default Import**: `import express from 'express';`
2. **ES6 Named Import**: `import { Router } from 'express';`
3. **ES6 Namespace Import**: `import * as express from 'express';`
4. **Dynamic Import**: `const express = await import('express');`
5. **CommonJS Require**: `const express = require('express');`

### Analysis Logic

The analyzer:
1. Finds all source files with extensions: `.ts`, `.js`, `.tsx`, `.jsx`, `.mts`, `.mjs`
2. Reads each file and extracts package imports using regex patterns
3. Ignores local imports (starting with `./` or `../`)
4. Matches imported packages against dependencies and devDependencies from package.json
5. Counts how many files import each package
6. Optionally collects all file paths where each package is used

### Implementation Rules

- **Never modify user files**: Only read source files
- **Ignore node_modules**: Skip scanning inside node_modules directories
- **Ignore hidden directories**: Skip directories starting with `.`
- **Handle errors gracefully**: Skip files that cannot be read, fail silently
- **Deterministic ordering**: Sort file paths and packages for consistent output

### Usage in Reports

When `--detailed` is enabled:
- Package Summary section shows total files analyzed and packages used
- Detailed Package Usage section lists each package with:
  - Package name and version
  - Number of files that import it
  - List of all file paths where it's used
- Packages with 0 usage are still listed (with empty file paths)

### Testing

Always test:
- Mixed ES6 and CommonJS imports in same project
- Scoped packages (e.g., `@nestjs/common`)
- Multiple imports of same package across different files
- Nested directories and complex file structures
- Edge cases: empty project, no source files, uninstalled packages

## New Rules for v0.4 - Extended Analysis

### New Finding IDs

| ID | Description | Severity |
|----|-------------|----------|
| `api.node_builtins` | Node.js built-in modules detected | green/yellow/red |
| `api.node_prefix` | Recommendation to use node: prefix | green |
| `modules.esm_cjs_mixed` | Mixed ESM/CJS imports in same file | yellow |
| `modules.cjs_globals` | CJS globals (__dirname, __filename) | yellow |

### Extended Analysis Options

- `--extended` or `-x`: Enable full extended analysis
- `--analyze api,modules`: Selective analysis

### Node.js Module Categories

**Green Zone** - Fully compatible:
- fs, path, url, util, events, stream, crypto, buffer, etc.

**Yellow Zone** - Behavior differences:
- child_process, http, https, worker_threads, etc.

**Red Zone** - Limited/no support:
- vm, v8, inspector, wasi

### CJS to ESM Migration

| CJS Global | ESM Replacement |
|------------|-----------------|
| `__dirname` | `import.meta.dirname` |
| `__filename` | `import.meta.url` |
| `require.main` | `import.meta.main` |

### Implementation Files

- `src/node_builtins.ts` - Module database
- `src/import_parser.ts` - Import parsing utilities
- `src/analyze_api.ts` - API compatibility analysis
- `src/analyze_modules.ts` - ESM/CJS analysis
