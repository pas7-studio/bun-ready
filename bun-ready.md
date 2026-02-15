# bun-ready report - Tested with Bun v24.3.0

✅ Congratulations, you're ready to migrate to Bun!

## Findings Summary
| Status | Count |
|--------|-------|
| 🟢 Green packages | 3 |
| 🟡 Yellow packages | 0 |
| 🔴 Red packages | 0 |
| **Total packages** | **3** |

**Overall:** 🟢 GREEN

## Summary
- Total packages analyzed: 1
- Workspaces detected: no
- Root package severity: green
- Overall severity: green
- Extended analysis: 4 additional finding(s)

**Report version:** 0.2

## Root Package
- Path: `C:/Users/nazarpes7/Desktop/bun-ready/package.json`
- Workspaces: no
- Name: bun-ready
- Version: 0.4.0

## Package Summary
- Total dependencies: 0
- Total devDependencies: 3
- Clean dependencies: 0
- Clean devDependencies: 3
- Dependencies with findings: 0
- DevDependencies with findings: 0

## Clean Dependencies (✅ GREEN)
**No migration risks detected - 3 total packages**

- Dependencies: 0
- DevDependencies: 3

## Root Findings
### Consider using `node:` prefix for Node.js built-ins (🟢 GREEN)

- Modules without `node:` prefix:
-   - http
-     tests\unit\usage_analyzer.test.ts:50
-     tests\unit\usage_analyzer.test.ts:88
-     tests\unit\usage_analyzer.test.ts:160

**Hints:**
- The `node:` prefix makes it explicit that you're using Node.js APIs.
- This improves code clarity and future-proofs for changes.
- Example: `import { readFileSync } from 'node:fs'`

### Node.js built-in modules detected: 7 modules (🟡 YELLOW)

- **Green Zone** (5 modules):
-   - node:crypto (2 files)
-   - node:fs (10 files)
-   - node:fs/promises (4 files)
-   - node:os (1 files)
-   - node:path (14 files)
- **Yellow Zone** (2 modules):
-   - http (3 files)
-   - node:child_process (1 files) - spawn behavior differs slightly in Bun

**Hints:**
- Yellow zone modules work in Bun but may have behavior differences.
- Test code using these modules carefully after migration.

### CJS-specific globals detected (🟡 YELLOW)

- Found CJS globals that may not work in ESM context:
- 
- **__dirname** (6 occurrences):
-   - src\analyze_modules.ts:284
-   - src\import_parser.ts:222
-   - src\import_parser.ts:26
-   - src\import_parser.ts:81
-   - src\import_parser.ts:82
-   - ... and 1 more
-   - Replace with: `import.meta.dirname`
-   - Note: Available in Node 20.11+ and Bun natively
- 
- **__filename** (6 occurrences):
-   - src\analyze_modules.ts:285
-   - src\import_parser.ts:223
-   - src\import_parser.ts:26
-   - src\import_parser.ts:84
-   - src\import_parser.ts:85
-   - ... and 1 more
-   - Replace with: `import.meta.url`
-   - Note: Returns URL string, use fileURLToPath for path
- 
- **require.main** (4 occurrences):
-   - src\analyze_modules.ts:286
-   - src\import_parser.ts:224
-   - src\import_parser.ts:87
-   - src\node_builtins.ts:401
-   - Replace with: `import.meta.main`
-   - Note: Bun-specific, checks if current file is entry point
- 
- **require.cache** (3 occurrences):
-   - src\import_parser.ts:225
-   - src\import_parser.ts:90
-   - src\node_builtins.ts:406
-   - Replace with: `N/A`
-   - Note: No direct ESM equivalent - module caching works differently
- 

**Hints:**
- Replace __dirname with import.meta.dirname (available in Bun and Node 20.11+)
- Replace __filename with import.meta.url (use fileURLToPath for path)
- Replace require.main === module with import.meta.main

### Mixed ESM/CJS imports detected (🟡 YELLOW)

- Found 3 file(s) with mixed ESM/CJS imports:
- 
- **src\import_parser.ts**
-   - ESM imports on lines: 57, 60, 63, 66
-   - CJS requires on lines: 69
- **src\usage_analyzer.ts**
-   - ESM imports on lines: 4, 5, 16
-   - CJS requires on lines: 18
- **tests\unit\usage_analyzer.test.ts**
-   - ESM imports on lines: 1, 2, 3, 6, 29, 35, 41, 48, 49, 50, 63, 70, 71, 72, 79, 86, 87, 88, 89, 91, 98, 115, 146, 154, 155, 161, 212, 220, 225, 230, 251, 259, 279, 287, 296, 314, 323, 328, 354, 362, 371
-   - CJS requires on lines: 57, 90, 160

**Hints:**
- Bun supports both ESM and CJS modules.
- However, mixing them in the same file can cause issues with some bundlers.
- Consider standardizing on ESM for better compatibility.

