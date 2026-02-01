// File: src/types.ts
// Існуючі типи - зберегти без змін
export type Severity = "green" | "yellow" | "red";

export type ReportFormat = "md" | "json";

export type InstallResult =
  | { ok: true; summary: string; logs: string[]; skipReason?: string }
  | { ok: false; summary: string; logs: string[]; skipReason?: string };

export type TestResult =
  | { ok: true; summary: string; logs: string[]; skipReason?: string }
  | { ok: false; summary: string; logs: string[]; skipReason?: string };

// Нові типи для конфіг файлу
export type FailOnPolicy = "green" | "yellow" | "red";

export type BunReadyConfig = {
  ignorePackages?: string[];
  ignoreFindings?: string[];
  nativeAddonAllowlist?: string[];
  failOn?: FailOnPolicy;
  detailed?: boolean;
};

// Нові типи для workspaces
export type WorkspaceScope = "root" | "packages" | "all";

export type PackageAnalysis = {
  name: string;
  path: string;
  severity: Severity;
  summaryLines: string[];
  findings: Finding[];
  install: InstallResult | null;
  test: TestResult | null;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  lockfiles: {
    bunLock: boolean;
    bunLockb: boolean;
    npmLock: boolean;
    yarnLock: boolean;
    pnpmLock: boolean;
  };
  stats?: PackageStats;
  findingsSummary?: FindingsSummary;
  packageUsage?: PackageUsageStats;
};

// Оновити ScanOptions з новими полями
export type ScanOptions = {
  repoPath: string;
  format: ReportFormat;
  outFile: string | null;
  runInstall: boolean;
  runTest: boolean;
  verbose: boolean;
  detailed: boolean;
  scope?: WorkspaceScope;
  failOn?: FailOnPolicy;
};

// Новий тип для результатів parsing bun install logs
export type InstallLogAnalysis = {
  blockedDeps: string[];
  trustedDepsMentioned: string[];
  notes: string[];
};

// Зберегти існуючий тип для сумісності
export type Finding = {
  id: string;
  title: string;
  severity: Severity;
  details: string[];
  hints: string[];
};

export type PackageStats = {
  totalDependencies: number;
  totalDevDependencies: number;
  cleanDependencies: number;
  cleanDevDependencies: number;
  riskyDependencies: number;
  riskyDevDependencies: number;
};

export interface FindingsSummary {
  green: number;
  yellow: number;
  red: number;
  total: number;
}

// New types for package usage analysis
export interface PackageUsage {
  packageName: string;
  fileCount: number;
  filePaths: string[];
}

export interface PackageUsageStats {
  totalPackages: number;
  analyzedFiles: number;
  usageByPackage: Map<string, PackageUsage>; // packageName -> usage info
}

// Новий тип для OverallResult (v0.2)
export type OverallResult = {
  version?: string; // "0.2"
  severity: Severity;
  summaryLines: string[];
  findings: Finding[];
  install: InstallResult | null;
  test: TestResult | null;
  repo: {
    packageJsonPath: string;
    hasWorkspaces: boolean;
    rootPackage?: {
      name: string;
      version: string;
    };
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
    packageJson?: {
      name?: string;
      version?: string;
      workspaces?: unknown;
      packages?: unknown;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      engines?: {
        node?: string;
      };
    };
  };
  packages?: PackageAnalysis[];
  config?: BunReadyConfig | null;
};

// Зберегти існуючий тип для сумісності (deprecated)
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
  rootPackage?: {
    name: string;
    version: string;
  };
  packageJson?: {
    name?: string;
    version?: string;
    workspaces?: unknown;
    packages?: unknown;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    engines?: {
      node?: string;
    };
  };
};

// Зберегти існуючий тип для сумісності (deprecated)
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type AnalysisResult = OverallResult; // alias for backwards compatibility
