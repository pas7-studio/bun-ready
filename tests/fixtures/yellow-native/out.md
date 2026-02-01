# bun-ready report

**Overall:** 🟡 YELLOW

## Summary
- Lockfiles: non-bun or missing
- Lifecycle scripts: present
- Native addon risk: yes
- bun install dry-run: skipped
- bun test: skipped

## Repo
- Path: `C:/Users/nazarpes7/Desktop/bun-ready/tests/fixtures/yellow-native/package.json`
- Workspaces: no
- Lockfiles: none

## Findings
### Potential native addons / node-gyp toolchain risk (🟡 YELLOW)

- sharp@^0.33.0

**Hints:**
- Native addons often require toolchains and can be sensitive to runtime differences.
- If you see install/build failures, try upgrading these packages or switching to pure-JS alternatives.

### No lockfile found (🟡 YELLOW)

- No bun.lock/bun.lockb, package-lock.json, yarn.lock, or pnpm-lock.yaml detected.

**Hints:**
- Lockfiles improve reproducibility. Consider committing one before migration.
- If you migrate to Bun, generate bun.lock and verify installs are stable.

### Lifecycle scripts in the root project (🟡 YELLOW)

- postinstall: node -e "console.log('postinstall')"

**Hints:**
- Bun runs your project lifecycle scripts during install. Verify they don't rely on npm-specific behavior.
- If scripts compile native deps, expect migration friction.
