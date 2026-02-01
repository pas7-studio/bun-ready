import type { BunReadyConfig, FindingsSummary, Finding, PackageStats, RepoInfo, Severity } from "./types.js";
import type { PackageJson } from "./internal_types.js";
import { stableSort } from "./util.js";

const NATIVE_SUSPECTS = [
  "node-gyp",
  "node-pre-gyp",
  "prebuild-install",
  "bindings",
  "nan",
  "node-addon-api",
  "node-sass",
  "sharp",
  "canvas",
  "better-sqlite3",
  "sqlite3",
  "bcrypt",
  "argon2",
  "bufferutil",
  "utf-8-validate",
  "fsevents"
];

// Expanded list of native addon suspects for v0.2
const NATIVE_SUSPECTS_V2 = [
  // Existing suspects
  "node-gyp",
  "node-pre-gyp",
  "prebuild-install",
  "bindings",
  "nan",
  "node-addon-api",
  "node-sass",
  "sharp",
  "canvas",
  "better-sqlite3",
  "sqlite3",
  "bcrypt",
  "argon2",
  "bufferutil",
  "utf-8-validate",
  "fsevents",
  // Additional v0.2 suspects
  "grpc",
  "@grpc/grpc-js",
  "grpc-js",
  "bcryptjs", // some use native variant
  "bcrypt",
  "sodium",
  "libsodium",
  "leveldb",
  "level",
  "rocksdb",
  "mysql2",
  "pg", // some versions have native bindings
  "oracledb",
  "nodegit",
  "ffi-napi",
  "node-ffi",
  "ref-napi",
  "skia-canvas",
  "jimp",
  "pdfkit",
  "sharp",
  "pixelmatch",
  "cheerio", // some versions use native
  "node-wav",
  "lamejs",
  "flac-bindings",
  "opus-recorder",
  "silk-wasm",
  "zeromq",
  "zeromq.js",
  "mongodb", // some versions
  "redis", // hiredis
  "ioredis",
  "elasticsearch",
  "snappy",
  "snappyjs",
  "iltorb",
  "brotli",
  "node-sha3",
  "ursa",
  "node-forge", // pure JS but often used with native
  "jsonwebtoken", // pure JS but check usage
  "node-cron", // pure JS but check
  "bull", // pure JS but uses ioredis
  "bullmq" // pure JS but uses ioredis
];

// Dev tools that may need migration attention
const DEV_TOOL_SUSPECTS = [
  "jest",
  "vitest",
  "mocha",
  "chai",
  "ava",
  "tap",
  "jasmine",
  "karma",
  "cypress",
  "playwright",
  "puppeteer",
  "selenium-webdriver",
  "webdriverio",
  "nightwatch",
  "testcafe",
  "protractor"
];

// Runtime/build tools that may need Bun compatibility checks
const RUNTIME_TOOL_SUSPECTS = [
  "ts-node",
  "tsx",
  "ts-node-dev",
  "nodemon",
  "babel",
  "@babel/core",
  "@babel/node",
  "babel-cli",
  "babel-register",
  "babel-preset-env",
  "webpack",
  "webpack-cli",
  "rollup",
  "@rollup/plugin",
  "esbuild",
  "vite",
  "@vitejs/plugin",
  "swc",
  "@swc/core",
  "@swc/register",
  "turbopack",
  "snowpack",
  "parcel",
  "browserify"
];

// Package manager specific commands
const PM_SPECIFIC_COMMANDS = [
  "npm ci",
  "npm run ci",
  "pnpm -r",
  "pnpm recursive",
  "pnpm workspaces",
  "yarn workspaces",
  "yarn workspace",
  "yarn -w",
  "lerna run",
  "nx run",
  "npx lerna",
  "npx nx",
  "turbo run",
  "rushx"
];

const includesAny = (s: string, needles: string[]): boolean => {
  const lower = s.toLowerCase();
  return needles.some((n) => lower.includes(n));
};

const maxSeverity = (a: Severity, b: Severity): Severity => {
  if (a === "red" || b === "red") return "red";
  if (a === "yellow" || b === "yellow") return "yellow";
  return "green";
};

export const detectScriptRisks = (repo: RepoInfo): Finding[] => {
  const findings: Finding[] = [];
  const scriptNames = Object.keys(repo.scripts);

  const lifecycle = ["preinstall", "install", "postinstall", "preprepare", "prepare", "postprepare"];
  const hits = stableSort(scriptNames.filter((s) => lifecycle.includes(s)), (x) => x);

  if (hits.length > 0) {
    const details = hits.map((k) => `${k}: ${repo.scripts[k] ?? ""}`.trim());
    findings.push({
      id: "scripts.lifecycle",
      title: "Lifecycle scripts in the root project",
      severity: "yellow",
      details,
      hints: [
        "Bun runs your project lifecycle scripts during install. Verify they don't rely on npm-specific behavior.",
        "If scripts compile native deps, expect migration friction."
      ]
    });
  }

  const npmSpecificNeedles = ["npm ", "npx ", "pnpm ", "yarn ", "npm_config_", "corepack", "npm ci"];
  const npmish = stableSort(
    scriptNames.filter((k) => includesAny(repo.scripts[k] ?? "", npmSpecificNeedles)),
    (x) => x
  );

  if (npmish.length > 0) {
    findings.push({
      id: "scripts.npm_specific",
      title: "Scripts reference npm/yarn/pnpm-specific commands or env",
      severity: "yellow",
      details: npmish.map((k) => `${k}: ${repo.scripts[k] ?? ""}`.trim()),
      hints: [
        "Consider rewriting scripts to be runner-agnostic, or provide a Bun path.",
        "If using npm-only flags/behavior, verify equivalence on Bun."
      ]
    });
  }

  return findings;
};

export const detectNativeAddonRisk = (repo: RepoInfo): Finding[] => {
  const allDeps = {
    ...repo.dependencies,
    ...repo.devDependencies,
    ...repo.optionalDependencies
  };

  const names = Object.keys(allDeps);
  const suspects = stableSort(names.filter((n) => NATIVE_SUSPECTS.includes(n) || includesAny(n, ["napi", "node-gyp", "prebuild", "ffi"])), (x) => x);

  if (suspects.length === 0) return [];

  const hardRed = suspects.some((n) => n === "node-gyp" || n === "node-sass");
  const severity: Severity = hardRed ? "red" : "yellow";

  return [
    {
      id: "deps.native_addons",
      title: "Potential native addons / node-gyp toolchain risk",
      severity,
      details: suspects.map((n) => `${n}@${allDeps[n] ?? ""}`.trim()),
      hints: [
        "Native addons often require toolchains and can be sensitive to runtime differences.",
        "If you see install/build failures, try upgrading these packages or switching to pure-JS alternatives."
      ]
    }
  ];
};

export const detectLockfileSignals = (repo: RepoInfo): Finding[] => {
  const { bunLock, bunLockb, npmLock, yarnLock, pnpmLock } = repo.lockfiles;

  if (bunLock || bunLockb) return [];

  const anyOther = npmLock || yarnLock || pnpmLock;
  if (!anyOther) {
    return [
      {
        id: "lockfile.missing",
        title: "No lockfile found",
        severity: "yellow",
        details: ["No bun.lock/bun.lockb, package-lock.json, yarn.lock, or pnpm-lock.yaml detected."],
        hints: [
          "Lockfiles improve reproducibility. Consider committing one before migration.",
          "If you migrate to Bun, generate bun.lock and verify installs are stable."
        ]
      }
    ];
  }

  const present: string[] = [];
  if (npmLock) present.push("package-lock.json");
  if (yarnLock) present.push("yarn.lock");
  if (pnpmLock) present.push("pnpm-lock.yaml");

  return [
    {
      id: "lockfile.migration",
      title: "Non-Bun lockfile detected (Bun will likely migrate on first install)",
      severity: "yellow",
      details: [`Detected: ${present.join(", ")}`],
      hints: [
        "Run bun install once on a branch and review the generated bun.lock.",
        "Compare resolved versions and run your test suite."
      ]
    }
  ];
};

/**
 * Detect Node runtime API reliance risks
 * - engines.node < 18 is a yellow signal (older packages/infra)
 * - ts-node, tsx, babel, swc, webpack are yellow (check runtime/bundling compatibility)
 * - jest, vitest are yellow (may need migration to bun:test or config adjustments)
 */
export const detectRuntimeApiRisks = (repo: RepoInfo): Finding[] => {
  const findings: Finding[] = [];

  // Check engines.node
  if (repo.packageJson?.engines?.node) {
    const nodeVersion = repo.packageJson.engines.node;
    const match = nodeVersion.match(/>=?(\d+)/);
    if (match && match[1]) {
      const minVersion = parseInt(match[1], 10);
      if (minVersion < 18) {
        findings.push({
          id: "runtime.node_version",
          title: "Node.js version requirement is below Bun's baseline (v18+)",
          severity: "yellow",
          details: [`engines.node: ${nodeVersion}`],
          hints: [
            "Bun targets Node 18+ compatibility. Packages requiring older Node versions may need updates.",
            "Check if packages have updates or if version constraints can be relaxed."
          ]
        });
      }
    }
  }

  // Check for runtime/build tools in dependencies
  const allDeps = { ...repo.dependencies, ...repo.devDependencies, ...repo.optionalDependencies };
  const deps = Object.keys(allDeps);

  // Dev tools
  const devToolHits = deps.filter((d) => DEV_TOOL_SUSPECTS.includes(d) || deps.some((x) => x.startsWith(`${d}/`)));
  const relevantDevTools = devToolHits.filter((d) => allDeps[d]); // Only direct deps
  if (relevantDevTools.length > 0) {
    findings.push({
      id: "runtime.dev_tools",
      title: "Dev tools that may need Bun compatibility checks",
      severity: "yellow",
      details: relevantDevTools.map((d) => `${d}@${allDeps[d]}`),
      hints: [
        "Testing frameworks like jest/vitest may work, but consider migrating to bun:test for optimal performance.",
        "Build tools like webpack/esbuild/vite typically work with Bun, but verify your build pipeline.",
        "Check documentation for each tool's Bun compatibility status."
      ]
    });
  }

  // Runtime tools
  const runtimeToolHits = deps.filter((d) => RUNTIME_TOOL_SUSPECTS.includes(d) || deps.some((x) => x.startsWith(`${d}/`)));
  const relevantRuntimeTools = runtimeToolHits.filter((d) => allDeps[d]);
  if (relevantRuntimeTools.length > 0) {
    findings.push({
      id: "runtime.build_tools",
      title: "Runtime/build tools that may need Bun compatibility verification",
      severity: "yellow",
      details: relevantRuntimeTools.map((d) => `${d}@${allDeps[d]}`),
      hints: [
        "Tools like ts-node/tsx work with Bun, but verify your TypeScript configuration.",
        "Bundlers like webpack/vite/esbuild typically work with Bun, but verify your build scripts.",
        "Consider switching to Bun's native build capabilities for improved performance."
      ]
    });
  }

  // Check for ts-node/tsx usage in scripts
  const scriptNames = Object.keys(repo.scripts);
  const tsRuntimeScripts = scriptNames.filter((k) => {
    const script = repo.scripts[k]?.toLowerCase() || "";
    return script.includes("ts-node") || script.includes("tsx") || script.includes("babel-node");
  });

  if (tsRuntimeScripts.length > 0) {
    findings.push({
      id: "runtime.ts_execution",
      title: "Scripts use TypeScript runtime execution (ts-node/tsx/babel-node)",
      severity: "yellow",
      details: tsRuntimeScripts.map((k) => `${k}: ${repo.scripts[k]}`),
      hints: [
        "Bun supports TypeScript natively, but verify tsconfig compatibility.",
        "Consider migrating scripts to use `bun run` directly with TypeScript files.",
        "Test execution of affected scripts with Bun before full migration."
      ]
    });
  }

  return findings;
};

/**
 * Detect package manager specific assumptions
 * - npm ci, pnpm -r, yarn workspaces, lerna, nx, turbo commands
 */
export const detectPmAssumptions = (repo: RepoInfo): Finding[] => {
  const findings: Finding[] = [];
  const scriptNames = Object.keys(repo.scripts);

  const pmSpecificHits: Array<{ name: string; command: string }> = [];
  for (const scriptName of scriptNames) {
    const script = repo.scripts[scriptName] || "";
    const lowerScript = script.toLowerCase();

    for (const cmd of PM_SPECIFIC_COMMANDS) {
      if (lowerScript.includes(cmd.toLowerCase())) {
        pmSpecificHits.push({ name: scriptName, command: cmd });
        break;
      }
    }
  }

  if (pmSpecificHits.length > 0) {
    findings.push({
      id: "scripts.pm_assumptions",
      title: "Scripts contain package-manager-specific commands",
      severity: "yellow",
      details: pmSpecificHits.map((h) => `${h.name}: uses "${h.command}"`),
      hints: [
        "Package-manager-specific commands may need adaptation for Bun.",
        "Test each affected script with Bun to ensure compatibility.",
        "Consider rewriting scripts to be package-manager agnostic where possible."
      ]
    });
  }

  return findings;
};

/**
 * Enhanced native addon detection for v0.2
 * - Expanded list of native addon suspects
 * - RED for explicit node-gyp, node-sass or node-gyp rebuild in scripts
 * - YELLOW for other native addon suspects
 */
export const detectNativeAddonRiskV2 = (repo: RepoInfo, config?: BunReadyConfig): Finding[] => {
  const allDeps = {
    ...repo.dependencies,
    ...repo.devDependencies,
    ...repo.optionalDependencies
  };

  const names = Object.keys(allDeps);
  
  // Check for allowlist
  const allowlist = config?.nativeAddonAllowlist || [];
  
  const suspects = names.filter((n) => {
    // Skip if in allowlist
    if (allowlist.includes(n)) return false;
    
    // Check if in NATIVE_SUSPECTS_V2 list
    const inList = NATIVE_SUSPECTS_V2.includes(n);
    if (inList) return true;
    
    // Check for keyword matches - use more specific patterns to avoid false positives
    const keywords = ["@napi-rs/", "napi-rs", "node-napi", "neon", "node-gyp", "prebuild", "ffi", "bindings", "native", "native-module"];
    const keywordMatch = includesAny(n, keywords);
    
    if (keywordMatch) {
      return true;
    }
    
    return false;
  });

  // Check scripts for node-gyp rebuild
  const scriptNames = Object.keys(repo.scripts);
  const hasNodeGypRebuild = scriptNames.some((k) => {
    const script = repo.scripts[k]?.toLowerCase() || "";
    return script.includes("node-gyp") || script.includes("node-gyp rebuild");
  });

  // Return empty only if no suspects AND no node-gyp rebuild in scripts
  if (suspects.length === 0 && !hasNodeGypRebuild) return [];

  const hardRed = suspects.some((n) => n === "node-gyp" || n === "node-sass") || hasNodeGypRebuild;
  const severity: Severity = hardRed ? "red" : "yellow";

  return [
    {
      id: "deps.native_addons",
      title: "Potential native addons / node-gyp toolchain risk",
      severity,
      details: suspects.map((n) => `${n}@${allDeps[n]}`),
      hints: [
        "Native addons often require toolchains and can be sensitive to runtime differences.",
        "If you see install/build failures, try upgrading these packages or switching to pure-JS alternatives.",
        "Some packages offer optional native modules that can be disabled via configuration.",
        "Check if native modules are in use or just installed for optional features."
      ]
    }
  ];
};

export const summarizeSeverity = (findings: Finding[], installOk: boolean | null, testOk: boolean | null): Severity => {
  let sev: Severity = "green";
  for (const f of findings) sev = maxSeverity(sev, f.severity);
  if (installOk === false) sev = "red";
  if (testOk === false) sev = "red";
  return sev;
};

/**
 * Calculate package statistics
 * - Counts total dependencies and devDependencies
 * - Determines which packages are clean vs risky based on findings
 */
export const calculatePackageStats = (
  pkg: PackageJson,
  findings: Finding[]
): PackageStats => {
  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};

  // Get all dependency names mentioned in findings
  const riskyPackageNames = new Set<string>();
  for (const finding of findings) {
    for (const detail of finding.details) {
      // Parse package names from detail strings like "sharp@^0.33.0"
      // or "sharp: ^0.33.0"
      const match = detail.match(/^([a-zA-Z0-9_@\/\.\-]+)/);
      if (match && match[1]) {
        // Extract the package name (before @ or :)
        const fullPkg = match[1];
        const pkgName = fullPkg.split(/[@:]/)[0];
        if (pkgName) {
          riskyPackageNames.add(pkgName);
        }
      }
    }
  }

  // Count clean vs risky dependencies
  let cleanDependencies = 0;
  let riskyDependencies = 0;
  let cleanDevDependencies = 0;
  let riskyDevDependencies = 0;

  for (const depName of Object.keys(dependencies)) {
    if (riskyPackageNames.has(depName)) {
      riskyDependencies++;
    } else {
      cleanDependencies++;
    }
  }

  for (const depName of Object.keys(devDependencies)) {
    if (riskyPackageNames.has(depName)) {
      riskyDevDependencies++;
    } else {
      cleanDevDependencies++;
    }
  }

  return {
    totalDependencies: Object.keys(dependencies).length,
    totalDevDependencies: Object.keys(devDependencies).length,
    cleanDependencies,
    cleanDevDependencies,
    riskyDependencies,
    riskyDevDependencies
  };
};

export const calculateFindingsSummary = (findings: Finding[]): FindingsSummary => {
  let green = 0;
  let yellow = 0;
  let red = 0;

  for (const finding of findings) {
    if (finding.severity === "green") {
      green++;
    } else if (finding.severity === "yellow") {
      yellow++;
    } else if (finding.severity === "red") {
      red++;
    }
  }

  return {
    green,
    yellow,
    red,
    total: green + yellow + red
  };
};
