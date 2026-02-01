import { exec } from "./spawn.js";

/**
 * Check if Bun is available in the system
 */
export async function checkBunAvailable(): Promise<{ available: boolean; error?: string }> {
  try {
    // Try to run bun --version
    const res = await exec("bun", ["--version"], process.cwd());
    
    if (res.code === 0 && res.stdout.includes("bun")) {
      return { available: true };
    }
    
    return { 
      available: false, 
      error: `Bun command returned unexpected output (exit ${res.code})` 
    };
  } catch (error) {
    // Check for ENOENT error
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("ENOENT") || msg.includes("spawn bun ENOENT")) {
      return {
        available: false,
        error: "Bun is not installed. Please install Bun from https://bun.sh or use --no-install and --no-test flags."
      };
    }
    
    return {
      available: false,
      error: `Failed to check Bun availability: ${msg}`
    };
  }
}
