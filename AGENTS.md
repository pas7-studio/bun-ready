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
