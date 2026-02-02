// File: src/types.ts
// Existing types - keep unchanged
export type Severity = "green" | "yellow" | "red";

export type ReportFormat = "md" | "json" | "sarif";

export type InstallResult =
  | { ok: true; summary: string; logs: string[]; skipReason?: string }
  | { ok: false; summary: string; logs: string[]; skipReason?: string };

export type TestResult =
  | { ok: true; summary: string; logs: string[]; skipReason?: string }
  | { ok: false; summary: string; logs: string[]; skipReason?: string };

// New types for config file
export type FailOnPolicy = "green" | "yellow" | "red";

export type BunReadyConfig = {
  ignorePackages?: string[];
  ignoreFindings?: string[];
  nativeAddonAllowlist?: string[];
  failOn?: FailOnPolicy;
  detailed?: boolean;
  // v0.3 extensions
  rules?: PolicyRule[];
  thresholds?: PolicyThresholds;
};

// New types for workspaces
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
  cleanDependencies?: string[];
  cleanDevDependencies?: string[];
  // Package classification fields
  greenPackages?: string[];      // Packages without issues
  yellowPackages?: string[];    // Packages with issues
  redPackages?: string[];       // Critical packages
};

// Update ScanOptions with new fields
export type ScanOptions = {
  repoPath: string;
  format?: ReportFormat;
  outFile: string | null;
  runInstall: boolean;
  runTest: boolean;
  verbose: boolean;
  detailed: boolean;
  scope?: WorkspaceScope;
  failOn?: FailOnPolicy;
  ci?: CIOptions;
  outputDir?: string;
};

// New type for parsing bun install logs results
export type InstallLogAnalysis = {
  blockedDeps: string[];
  trustedDepsMentioned: string[];
  notes: string[];
};

// Keep existing type for compatibility
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
  // Old fields (deprecated - will be removed later)
  green: number;
  yellow: number;
  red: number;
  total: number;
  
  // New fields - package classification
  greenPackagesCount?: number;     // Number of packages without issues
  yellowPackagesCount?: number;   // Number of packages with issues
  redPackagesCount?: number;      // Number of critical packages
  totalPackagesCount?: number;    // Total number of packages
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

// New type for OverallResult (v0.2)
export type OverallResult = {
  version?: string; // "0.2" | "0.3"
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
  // v0.3 extensions
  policyApplied?: PolicySummary;
  baselineComparison?: BaselineComparison;
  changedPackages?: string[];
  ciSummary?: CISummary;
};

// Keep existing type for compatibility (deprecated)
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

// Keep existing type for compatibility (deprecated)
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type AnalysisResult = OverallResult; // alias for backwards compatibility

// ============================================================================
// v0.3 NEW TYPES
// ============================================================================

// Policy types
export type RuleAction = "fail" | "warn" | "off" | "ignore";
export type SeverityChange = "upgrade" | "downgrade" | "same";

export type PolicyRule = {
  id: string; // finding id або "*"
  action?: RuleAction;
  severityChange?: SeverityChange;
  reason?: string;
};

export type PolicyThresholds = {
  maxWarnings?: number;
  maxPackagesRed?: number;
  maxPackagesYellow?: number;
};

export type PolicyConfig = {
  rules?: PolicyRule[];
  thresholds?: PolicyThresholds;
  failOn?: FailOnPolicy;
};

export type AppliedPolicyRule = {
  findingId: string;
  action: RuleAction;
  originalSeverity?: Severity;
  newSeverity?: Severity;
  reason?: string;
};

export type PolicySummary = {
  rulesApplied: number;
  findingsModified: number;
  findingsDisabled: number;
  severityUpgraded: number;
  severityDowngraded: number;
  rules: AppliedPolicyRule[];
};

// Baseline types
export type FindingFingerprint = {
  id: string;
  packageName?: string;
  severity: Severity;
  detailsHash: string;
};

export type BaselineMetrics = {
  totalFindings: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  packagesGreen: number;
  packagesYellow: number;
  packagesRed: number;
};

export type BaselineData = {
  version: string; // "0.3"
  scanVersion?: string; // bun-ready version
  timestamp: string; // ISO timestamp
  repoPath: string;
  findings: FindingFingerprint[];
  metrics: BaselineMetrics;
};

export type BaselineComparison = {
  newFindings: FindingFingerprint[];
  resolvedFindings: FindingFingerprint[];
  severityChanges: {
    fingerprint: FindingFingerprint;
    oldSeverity: Severity;
    newSeverity: Severity;
  }[];
  isRegression: boolean;
  regressionReasons: string[];
};

// SARIF types
export type SarifLevel = "note" | "warning" | "error";

export type SarifRule = {
  id: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  help?: { text: string };
  defaultConfiguration: { level: SarifLevel };
};

export type SarifResult = {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
};

export type SarifLocation = {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine?: number; endLine?: number };
  };
};

export type SarifRun = {
  tool: {
    driver: {
      name: string;
      version: string;
      semanticVersion?: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
};

export type SarifLog = {
  version: string;
  $schema: string;
  runs: SarifRun[];
};

// CI types
export type CIOptions = {
  mode: boolean;
  outputDir?: string;
  minVerbose?: boolean;
};

export type CISummary = {
  verdict: Severity;
  topFindings: string[];
  nextActions: string[];
  exitCode: number;
};

// Changed-only types
export type ChangedOnlyOptions = {
  enabled: boolean;
  sinceRef?: string;
  baseBranch?: string;
};

// Updated ScanOptions for v0.3
export type ScanOptionsV03 = Omit<ScanOptions, "format"> & {
  format?: ReportFormat;
  ci?: CIOptions;
  policy?: PolicyConfig;
  baseline?: {
    file: string;
    update?: boolean;
  };
  changedOnly?: ChangedOnlyOptions;
  outputDir?: string;
};

// Updated OverallResult for v0.3 (extends v0.2)
export type OverallResultV03 = OverallResult & {
  version: "0.3";
  policyApplied?: PolicySummary;
  baselineComparison?: BaselineComparison;
  changedPackages?: string[];
  ciSummary?: CISummary;
};
