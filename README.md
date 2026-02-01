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
