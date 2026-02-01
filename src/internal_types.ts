// File: src/internal_types.ts
export type PackageJson = {
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
