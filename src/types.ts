export type Severity = "green" | "yellow" | "red";

export type ReportFormat = "md" | "json";

export type ScanOptions = {
  repoPath: string;
  format: ReportFormat;
  outFile: string | null;
  runInstall: boolean;
  runTest: boolean;
  verbose: boolean;
};

export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  details: string[];
  hints: string[];
};

export type InstallResult =
  | { ok: true; summary: string; logs: string[] }
  | { ok: false; summary: string; logs: string[] };

export type TestResult =
  | { ok: true; summary: string; logs: string[] }
  | { ok: false; summary: string; logs: string[] };

export type RepoInfo = {
  packageJsonPath: string;
  lockfiles: {
    bunLock: boolean;
    bunLockb: boolean;
    npmLock: boolean;
    yarnLock: boolean;
    pnpmLock: boolean;
  };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  hasWorkspaces: boolean;
};

export type AnalysisResult = {
  severity: Severity;
  summaryLines: string[];
  findings: Finding[];
  install: InstallResult | null;
  test: TestResult | null;
  repo: RepoInfo;
};
