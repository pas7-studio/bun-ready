# Contributing

Thanks for contributing to bun-ready.

## Development
Requirements:
- Bun
- Node.js >= 18 (optional, for running the built JS with node)

Install:
```bash
bun install
```

Run tests:
```bash
bun test
```

Typecheck:
```bash
bun run check
```

Build:
```bash
bun run build
```

## Principles
- Deterministic output: stable ordering in reports
- No silent modifications of user projects
- Conservative heuristics: explain "why" with actionable hints
- Keep the MVP small and fast

## Pull Requests
- Keep PRs focused
- Add/adjust tests for behavior changes
- Update README if CLI behavior changes
