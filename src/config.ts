// File: src/config.ts
import path from "node:path";
import { fileExists, readJsonFile } from "./util.js";
import type { BunReadyConfig, FailOnPolicy } from "./types.js";

const CONFIG_FILE_NAME = "bun-ready.config.json";

/**
 * Read and parse bun-ready.config.json from the given root path
 * Returns null if config file doesn't exist
 */
export async function readConfig(rootPath: string): Promise<BunReadyConfig | null> {
  const configPath = path.join(rootPath, CONFIG_FILE_NAME);
  
  if (!(await fileExists(configPath))) {
    return null;
  }

  try {
    const config = await readJsonFile<BunReadyConfig>(configPath);
    return validateConfig(config);
  } catch (error) {
    // If config exists but is invalid, log warning and return null
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Warning: Invalid ${CONFIG_FILE_NAME}: ${msg}\n`);
    return null;
  }
}

/**
 * Validate and sanitize the config object
 */
function validateConfig(config: unknown): BunReadyConfig | null {
  if (!config || typeof config !== "object") {
    return null;
  }

  const cfg = config as Record<string, unknown>;
  const result: BunReadyConfig = {};

  // Validate ignorePackages
  if (Array.isArray(cfg.ignorePackages)) {
    const validIgnore = cfg.ignorePackages.filter((p): p is string => typeof p === "string");
    if (validIgnore.length > 0) {
      result.ignorePackages = validIgnore;
    }
  }

  // Validate ignoreFindings
  if (Array.isArray(cfg.ignoreFindings)) {
    const validIgnore = cfg.ignoreFindings.filter((f): f is string => typeof f === "string");
    if (validIgnore.length > 0) {
      result.ignoreFindings = validIgnore;
    }
  }

  // Validate nativeAddonAllowlist
  if (Array.isArray(cfg.nativeAddonAllowlist)) {
    const validAllowlist = cfg.nativeAddonAllowlist.filter((p): p is string => typeof p === "string");
    if (validAllowlist.length > 0) {
      result.nativeAddonAllowlist = validAllowlist;
    }
  }

  // Validate failOn
  if (typeof cfg.failOn === "string") {
    const validFailOn = ["green", "yellow", "red"].includes(cfg.failOn);
    if (validFailOn) {
      result.failOn = cfg.failOn as FailOnPolicy;
    }
  }

  // Return null if no valid fields found
  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

/**
 * Merge config with CLI options (CLI options take precedence)
 */
export function mergeConfigWithOpts(
  config: BunReadyConfig | null,
  opts: { failOn?: FailOnPolicy }
): BunReadyConfig | null {
  if (!config && !opts.failOn) {
    return null;
  }

  const result: BunReadyConfig = {
    ...(config || {})
  };

  // CLI options override config
  if (opts.failOn) {
    result.failOn = opts.failOn;
  }

  return Object.keys(result).length > 0 ? result : null;
}
