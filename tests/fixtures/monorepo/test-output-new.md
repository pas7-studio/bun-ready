# bun-ready report - Tested with Bun v24.3.0

⚠️ Migration is possible with some adjustments required

## Findings Summary
| Status | Count |
|--------|-------|
| 🟢 Green packages | 0 |
| 🟡 Yellow packages | 0 |
| 🔴 Red packages | 0 |
| **Total packages** | **0** |

**Overall:** 🟡 YELLOW

## Summary
- Total packages analyzed: 5
- Workspaces detected: yes
- Workspace packages: 4
- Root package severity: yellow
- Overall severity: yellow

**Report version:** 0.2

## Root Package
- Path: `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/package.json`
- Workspaces: yes
- Name: fixture-monorepo
- Version: 1.0.0

## Packages Overview
| Package | Path | Status | Key Findings |
|---------|------|--------|--------------|
| fixture-monorepo | `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo` | 🟡 YELLOW | 🟡 YELLOW No lockfile found |
| fixture-monorepo-pkg-a | `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/a` | 🟢 GREEN | No issues |
| fixture-monorepo-pkg-b | `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/b` | 🟡 YELLOW | 🟡 YELLOW No lockfile found, 🟡 YELLOW Node.js version requirement is below Bun's baseline (v18+) |
| fixture-monorepo-pkg-c | `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/c` | 🔴 RED | 🔴 RED Potential native addons / node-gyp toolchain risk, 🟡 YELLOW No lockfile found |
| fixture-monorepo-pkg-d | `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/d` | 🟡 YELLOW | 🟡 YELLOW Non-Bun lockfile detected (Bun will likely migrate on first install), 🟡 YELLOW Scripts reference npm/yarn/pnpm-specific commands or env |

## Package Summary
- Total dependencies: 0
- Total devDependencies: 0
- Clean dependencies: 0
- Clean devDependencies: 0
- Dependencies with findings: 0
- DevDependencies with findings: 0

## Root Findings
### No lockfile found (🟡 YELLOW)

- No bun.lock/bun.lockb, package-lock.json, yarn.lock, or pnpm-lock.yaml detected.

**Hints:**
- Lockfiles improve reproducibility. Consider committing one before migration.
- If you migrate to Bun, generate bun.lock and verify installs are stable.


## Package: fixture-monorepo (🟡 YELLOW)

**Path:** `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo`

- Lockfiles: non-bun or missing
- Lifecycle scripts: none
- Native addon risk: no
- bun install dry-run: skipped
- bun test: skipped

**Package Summary**
- Total dependencies: 0
- Total devDependencies: 0
- Clean dependencies: 0
- Clean devDependencies: 0
- Dependencies with findings: 0
- DevDependencies with findings: 0

**Findings:**

### No lockfile found (🟡 YELLOW)
- No bun.lock/bun.lockb, package-lock.json, yarn.lock, or pnpm-lock.yaml detected.
**Hints:**
- Lockfiles improve reproducibility. Consider committing one before migration.
- If you migrate to Bun, generate bun.lock and verify installs are stable.

## Package: fixture-monorepo-pkg-a (🟢 GREEN)

**Path:** `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/a`

- Lockfiles: bun
- Lifecycle scripts: none
- Native addon risk: no
- bun install dry-run: skipped
- bun test: skipped

**Package Summary**
- Total dependencies: 1
- Total devDependencies: 0
- Clean dependencies: 1
- Clean devDependencies: 0
- Dependencies with findings: 0
- DevDependencies with findings: 0

**Findings:**
No findings for this package.

## Package: fixture-monorepo-pkg-b (🟡 YELLOW)

**Path:** `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/b`

- Lockfiles: non-bun or missing
- Lifecycle scripts: present
- Native addon risk: no
- bun install dry-run: skipped
- bun test: skipped

**Package Summary**
- Total dependencies: 1
- Total devDependencies: 0
- Clean dependencies: 1
- Clean devDependencies: 0
- Dependencies with findings: 0
- DevDependencies with findings: 0

**Findings:**

### No lockfile found (🟡 YELLOW)
- No bun.lock/bun.lockb, package-lock.json, yarn.lock, or pnpm-lock.yaml detected.
**Hints:**
- Lockfiles improve reproducibility. Consider committing one before migration.
- If you migrate to Bun, generate bun.lock and verify installs are stable.

### Node.js version requirement is below Bun's baseline (v18+) (🟡 YELLOW)
- engines.node: >=14
**Hints:**
- Bun targets Node 18+ compatibility. Packages requiring older Node versions may need updates.
- Check if packages have updates or if version constraints can be relaxed.

### Lifecycle scripts in the root project (🟡 YELLOW)
- postinstall: node -e "console.log('postinstall in pkg-b')"
**Hints:**
- Bun runs your project lifecycle scripts during install. Verify they don't rely on npm-specific behavior.
- If scripts compile native deps, expect migration friction.

## Package: fixture-monorepo-pkg-c (🔴 RED)

**Path:** `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/c`

- Lockfiles: non-bun or missing
- Lifecycle scripts: none
- Native addon risk: yes
- bun install dry-run: skipped
- bun test: skipped

**Package Summary**
- Total dependencies: 2
- Total devDependencies: 1
- Clean dependencies: 0
- Clean devDependencies: 0
- Dependencies with findings: 2
- DevDependencies with findings: 1

**Findings:**

### Potential native addons / node-gyp toolchain risk (🔴 RED)
- sharp@^0.33.0
- node-sass@^7.0.3
**Hints:**
- Native addons often require toolchains and can be sensitive to runtime differences.
- If you see install/build failures, try upgrading these packages or switching to pure-JS alternatives.
- Some packages offer optional native modules that can be disabled via configuration.
- Check if native modules are in use or just installed for optional features.

### No lockfile found (🟡 YELLOW)
- No bun.lock/bun.lockb, package-lock.json, yarn.lock, or pnpm-lock.yaml detected.
**Hints:**
- Lockfiles improve reproducibility. Consider committing one before migration.
- If you migrate to Bun, generate bun.lock and verify installs are stable.

### Dev tools that may need Bun compatibility checks (🟡 YELLOW)
- jest@^29.7.0
**Hints:**
- Testing frameworks like jest/vitest may work, but consider migrating to bun:test for optimal performance.
- Build tools like webpack/esbuild/vite typically work with Bun, but verify your build pipeline.
- Check documentation for each tool's Bun compatibility status.

## Package: fixture-monorepo-pkg-d (🟡 YELLOW)

**Path:** `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/monorepo/packages/d`

- Lockfiles: non-bun or missing
- Lifecycle scripts: none
- Native addon risk: no
- bun install dry-run: skipped
- bun test: skipped

**Package Summary**
- Total dependencies: 1
- Total devDependencies: 0
- Clean dependencies: 1
- Clean devDependencies: 0
- Dependencies with findings: 0
- DevDependencies with findings: 0

**Findings:**

### Non-Bun lockfile detected (Bun will likely migrate on first install) (🟡 YELLOW)
- Detected: package-lock.json
**Hints:**
- Run bun install once on a branch and review the generated bun.lock.
- Compare resolved versions and run your test suite.

### Scripts reference npm/yarn/pnpm-specific commands or env (🟡 YELLOW)
- build: npm run build
**Hints:**
- Consider rewriting scripts to be runner-agnostic, or provide a Bun path.
- If using npm-only flags/behavior, verify equivalence on Bun.
