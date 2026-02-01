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
