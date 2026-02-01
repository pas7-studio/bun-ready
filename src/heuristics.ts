import type { Finding, RepoInfo, Severity } from "./types.js";
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

export const summarizeSeverity = (findings: Finding[], installOk: boolean | null, testOk: boolean | null): Severity => {
  let sev: Severity = "green";
  for (const f of findings) sev = maxSeverity(sev, f.severity);
  if (installOk === false) sev = "red";
  if (testOk === false) sev = "red";
  return sev;
};
