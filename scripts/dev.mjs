import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT_DIR, run } from "./env.mjs";
import { runLocalWrangler } from "./dev-lifecycle.mjs";
import { LOCAL_WRANGLER_PORT } from "./dev-process-ownership.mjs";

export function localWranglerCommand(rootDir = ROOT_DIR) {
  return {
    command: process.execPath,
    args: [
      resolve(rootDir, "node_modules", "wrangler", "bin", "wrangler.js"),
      "dev",
      "--port",
      LOCAL_WRANGLER_PORT,
    ],
  };
}

export async function runDev(argv = process.argv.slice(2), deps = {}) {
  const runCommand = deps.run ?? run;
  const makeWranglerCommand = deps.localWranglerCommand ?? localWranglerCommand;
  const runWrangler = deps.runLocalWrangler ?? runLocalWrangler;

  if (!argv.includes("--skip-build")) runCommand("npm", ["run", "build"]);
  return runWrangler(makeWranglerCommand());
}

async function main() {
  try {
    const result = await runDev();
    process.exitCode = result?.exitCode ?? 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
