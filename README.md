# bun-ready

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/pas7studio)  
PayPal: https://www.paypal.com/ncp/payment/KDSSNKK8REDM8

CLI that estimates whether a repository will "survive" migrating to **Bun** — quickly.  
It inspects `package.json`, lockfiles, scripts, and can run `bun install --dry-run` in a temp directory. It then generates a **green / yellow / red** Markdown report with reasons.

## Why
Bun moves fast. People need a fast risk signal before they try to migrate a repo.

## Install
### Run without installing (recommended)
```bash
bunx bun-ready scan .
```

### Install globally
```bash
bun install -g bun-ready
bun-ready scan .
```

## Usage
```bash
bun-ready scan <path> [--format md|json] [--out <file>] [--no-install] [--no-test] [--verbose]
```

## Examples:
```bash
bun-ready scan .
bun-ready scan . --out bun-ready.md
bun-ready scan ./packages/api --format json
bun-ready scan . --no-install --no-test
```

## Exit codes
- 0 → GREEN
- 2 → YELLOW
- 3 → RED

## Monorepo / Workspaces Support

bun-ready now supports scanning monorepo projects with multiple workspace packages.

### Workspace Discovery

If your `package.json` contains a `workspaces` field (array or object), bun-ready will:
- Discover all workspace packages automatically
- Analyze each package individually
- Aggregate results into a single report

### Configuration

You can create a `bun-ready.config.json` file in your repository root to customize the scan:

```json
{
  "ignorePackages": ["packages/legacy"],
  "ignoreFindings": ["scripts.pm_assumptions"],
  "nativeAddonAllowlist": ["fsevents"],
  "failOn": "yellow"
}
```

### Options

| Option | Description | Default |
|---------|-------------|----------|
| `ignorePackages` | Array of package paths to ignore | `[]` |
| `ignoreFindings` | Array of finding IDs to ignore | `[]` |
| `nativeAddonAllowlist` | Packages to exclude from native addon checks | `[]` |
| `failOn` | When to return non-zero exit code | `"red"` |

### New CLI Flags

`--scope root|packages|all`
- `root`: Scan only the root package.json
- `packages`: Scan only workspace packages
- `all`: Scan root and all workspace packages (default)

`--fail-on green|yellow|red`
- Controls when bun-ready exits with a failure code
- `green`: Fail on anything not green (exit 3)
- `yellow`: Fail on red only (exit 3), yellow passes (exit 0)
- `red`: Default behavior - green=0, yellow=2, red=3

## How Scoring Works

bun-ready uses a combination of heuristics to determine migration readiness:

### Severity Levels

**🟢 GREEN** - Ready to migrate
- No critical issues detected
- Bun install succeeds
- Tests pass (if compatible)
- No native addon risks or properly handled

**🟡 YELLOW** - Migration possible with manual fixes
- Lifecycle scripts present (verify npm compatibility)
- Native addons detected (may need updates)
- Package manager assumptions in scripts
- Node version < 18
- Dev tools that may need configuration

**🔴 RED** - Migration blocked
- Bun install fails
- Native build tools (node-gyp, node-sass)
- Critical missing dependencies
- Tests fail

### Findings Categories

- `scripts.lifecycle` - Lifecycle scripts in root or dependencies
- `scripts.npm_specific` - npm/yarn/pnpm-specific commands
- `scripts.pm_assumptions` - Package manager assumptions
- `deps.native_addons` - Native addon dependencies
- `runtime.node_version` - Node.js version requirements
- `runtime.dev_tools` - Testing frameworks (jest, vitest, etc.)
- `runtime.build_tools` - Build tools (webpack, babel, etc.)
- `runtime.ts_execution` - TypeScript runtime execution
- `lockfile.missing` - No lockfile detected
- `lockfile.migration` - Non-Bun lockfile present
- `install.blocked_scripts` - Scripts blocked by Bun
- `install.trusted_deps` - Trusted dependencies mentioned

## FAQ

### Why yellow when there's a postinstall script?

Bun runs your project's lifecycle scripts during install, but **does not run** lifecycle scripts of dependencies unless they're in `trustedDependencies`. The yellow warning reminds you to verify these scripts work correctly with Bun.

### What are trustedDependencies?

Bun's `trustedDependencies` configuration controls which packages are allowed to run their lifecycle scripts. You can add trusted packages to this field in your `package.json`:

```json
{
  "trustedDependencies": ["some-package"]
}
```

### How do I handle monorepo scanning?

For monorepos, bun-ready automatically detects workspaces and scans all packages. Use `--scope` to control what's scanned:

```bash
# Scan everything (default)
bun-ready scan .

# Scan only root package
bun-ready scan . --scope root

# Scan only workspace packages
bun-ready scan . --scope packages
```

### Can I ignore certain findings?

Yes! Create a `bun-ready.config.json` file:

```json
{
  "ignoreFindings": ["scripts.pm_assumptions"]
}
```

### What if a package is in the native addon list but works with Bun?

Add it to the allowlist:

```json
{
  "nativeAddonAllowlist": ["fsevents"]
}
```

Some packages have optional native modules that can be disabled or work fine with Bun.

## What it checks (MVP)
- package.json presence & shape
- lockfiles (npm/yarn/pnpm/bun)
- scripts (postinstall/prepare, npm-specific patterns)
- heuristics for native addons / node-gyp risk
- optional: bun install --dry-run in a temp dir
- optional: bun test if tests appear Bun-compatible

## Contributing
See CONTRIBUTING.md. For security issues, see SECURITY.md.

## Support
If this tool saves you time, consider supporting:
- Ko-fi: https://ko-fi.com/pas7studio
- PayPal: https://www.paypal.com/ncp/payment/KDSSNKK8REDM8

## Attribution
Created and maintained by Pas7 Studio
Website: https://pas7.com.ua/
LinkedIn: https://www.linkedin.com/company/pas7-studio
