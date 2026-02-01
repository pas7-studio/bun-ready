# Changelog

All notable changes to bun-ready will be documented in this file.

## [0.3.0] - 2024

### New Features

#### CI Mode
- Added `--ci` flag for stable, machine-friendly output
- Reduced "human noise" in stdout
- Stable section ordering in reports
- CI summary block with top findings and next actions
- Automatic artifact generation with `--output-dir`
- GitHub job summary support

#### SARIF Export
- Added `--format sarif` option
- Generates SARIF 2.1.0 format for GitHub Code Scanning
- Machine-readable findings with stable rule IDs
- Supports all finding types

#### Policy-as-Code
- Added `--rule <id>=<action>` CLI flag
- Added `--max-warnings <n>` threshold flag
- Support for policy rules in `bun-ready.config.json`
- Policy sources priority: CLI flags > config file > defaults
- Policy actions: `fail`, `warn`, `off`, `ignore`
- Severity changes: `upgrade`, `downgrade`, `same`
- Thresholds: `maxWarnings`, `maxPackagesRed`, `maxPackagesYellow`
- "Policy applied" section in reports

#### Baseline / Regression Gate
- Added `--baseline <file>` flag
- Added `--update-baseline` flag
- Finding fingerprint generation for stable comparisons
- Baseline comparison logic
- Detects: new findings, resolved findings, severity changes
- Regression verdict with actionable reasons
- "Baseline comparison" section in reports

#### Changed-Only Scanning
- Added `--changed-only` flag (for monorepos)
- Added `--since <ref>` flag (git ref for changed packages)
- Git diff path detection
- Package path mapping from changed files
- Partial verdict (without baseline) vs regression verdict (with baseline)
- "Scanned packages (changed-only)" section in reports

#### GitHub Action
- Created `.github/workflows/bun-ready-action.yml`
- Created `action.yml` for reusable action definition
- Automatic artifact upload
- GitHub job summary generation
- PR comment support
- All v0.3 features supported in action

### Enhancements

- Enhanced CLI with 8 new flags
- Updated type definitions for all v0.3 features
- Improved report formatting with new sections
- Better CI integration
- Machine-readable output support (JSON, SARIF)

### Documentation

- Added v0.3 features section to README
- Updated usage examples
- Added GitHub Action usage examples
- Enhanced configuration documentation
- Added policy rules and thresholds examples

### Bug Fixes

- Fixed SARIF URI generation issues
- Improved baseline comparison logic
- Enhanced CI summary generation

### Breaking Changes

None - v0.3 is fully backward compatible with v0.2

## [0.2.x] - Earlier Versions

See earlier git history for changes in v0.2.x versions.
