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
bun-ready scan <path> [--format md|json|sarif] [--out <file>] [--no-install] [--no-test] [--verbose] [--detailed] [--scope root|packages|all] [--fail-on green|yellow|red] [--ci] [--output-dir <dir>] [--rule <id>=<action>] [--max-warnings <n>] [--baseline <file>] [--update-baseline] [--changed-only] [--since <ref>]
```

## Examples:
```bash
bun-ready scan .
bun-ready scan . --out bun-ready.md
bun-ready scan ./packages/api --format json
bun-ready scan . --no-install --no-test
bun-ready scan . --detailed
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
| `detailed` | Enable detailed package usage analysis | `false` |

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

`--detailed`
 - Enables detailed package usage analysis
 - Shows which packages are used in which files
 - Provides file-by-file breakdown of imports
 - Output is written to `bun-ready-detailed.md` instead of `bun-ready.md`
 - Requires scanning of all `.ts`, `.js`, `.tsx`, `.jsx` files in the project
 - **Note:** This operation is slower as it needs to read and parse all source files

## Detailed Reports

When using the `--detailed` flag, bun-ready provides comprehensive package usage information:

### What it analyzes:
- All source files with extensions: `.ts`, `.js`, `.tsx`, `.jsx`, `.mts`, `.mjs`
- Import patterns supported:
  - ES6 imports: `import ... from 'package-name'`
  - Namespace imports: `import * as name from 'package-name'`
  - Dynamic imports: `import('package-name')`
  - CommonJS requires: `require('package-name')`
- Local imports (starting with `./` or `../`) are ignored
- Skips `node_modules` and hidden directories

### Output format:

The detailed report shows:
1. **Package Summary** - Total files analyzed and packages used
2. **Per-package usage** - For each package in your dependencies:
   - How many files import it
   - List of all file paths where it's used
3. **Regular findings** - All migration risk findings from standard analysis

### Example:
```bash
bun-ready scan . --detailed
```

This generates `bun-ready-detailed.md` with sections like:

```markdown
### @nestjs/common (15 files)
- src/main.ts
- src/app.module.ts
- src/auth/auth.service.ts
...
```

### Configuration:

You can also enable detailed reports via config file:

```json
{
  "detailed": true
}
```

When `detailed` is set in config, it acts as if `--detailed` was passed, unless overridden by CLI flags.

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

## v0.3 New Features

### CI Mode

Run in CI mode for stable, machine-friendly output:

```bash
bun-ready scan . --ci --output-dir .bun-ready-artifacts
```

**CI Mode Benefits:**
- Reduced "human noise" in stdout
- Stable section ordering in reports
- CI summary block with top findings and next actions
- Automatic artifact generation when `--output-dir` is specified

### SARIF Export

Generate SARIF 2.1.0 format for GitHub Code Scanning:

```bash
bun-ready scan . --format sarif --out bun-ready.sarif.json
```

### Policy-as-Code

Enforce organization-specific migration policies:

```bash
# CLI flags
bun-ready scan . --rule deps.native_addons=fail --max-warnings 5

# Or in config file
{
  "rules": [
    { "id": "deps.native_addons", "action": "fail" },
    { "id": "scripts.lifecycle", "action": "off" }
  ],
  "thresholds": {
    "maxWarnings": 10,
    "maxPackagesRed": 2
  }
}
```

**Policy Sources** (priority order):
1. CLI flags (`--rule`, `--max-warnings`)
2. `bun-ready.config.json` file
3. Default rules

**Policy Actions:**
- `fail` - Mark finding as failure
- `warn` - Downgrade to warning
- `off` - Disable this finding
- `ignore` - Ignore this finding (don't report)

### Baseline / Regression Detection

Prevent regressions by comparing against a baseline:

```bash
# Create baseline (first time)
bun-ready scan . --baseline bun-ready-baseline.json --update-baseline

# In CI - compare against baseline
bun-ready scan . --baseline bun-ready-baseline.json --ci
```

**Baseline Features:**
- Detects new findings
- Detects resolved findings
- Detects severity changes (upgrades/downgrades)
- Regression verdict: fails if new red findings or increased failures
- Update baseline with `--update-baseline`

### Changed-Only Scanning (Monorepos)

Scan only changed packages to speed up large monorepo PRs:

```bash
bun-ready scan . --changed-only --since main
```

**Changed-Only Verdict Types:**
- **Partial verdict** (no baseline): Warning about partial coverage
- **Regression verdict** (with baseline): OK - comparing only changed packages

### GitHub Action Integration

Use bun-ready as a GitHub Action:

```yaml
name: bun-ready Check
on: [pull_request]
jobs:
  bun-ready:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: ./  # Uses action.yml from repo
        with:
          fail-on: yellow
          baseline: bun-ready-baseline.json
```

**Action Features:**
- Automatic artifact upload
- GitHub job summary generation
- PR comment support
- SARIF export for Code Scanning
- Policy and baseline support

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
- Ko-fi: https://ko-fi.com/pas7-studio
- PayPal: https://www.paypal.com/ncp/payment/KDSSNKK8REDM8

## Attribution
Created and maintained by Pas7 Studio
Website: https://pas7.com.ua/
LinkedIn: https://www.linkedin.com/company/pas7-studio
