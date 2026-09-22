import { pathToFileURL } from "node:url";
import { loadRootEnv, requireEnv, run } from "./env.mjs";
import { runLocalWrangler } from "./dev-lifecycle.mjs";
import { prepareLocalWrangler } from "./dev-secrets.mjs";

const REQUIRED_LOCAL_ADMIN_VALUES = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"];

export async function runDev(argv = process.argv.slice(2), deps = {}) {
  const loadValues = deps.loadRootEnv ?? loadRootEnv;
  const requireValues = deps.requireEnv ?? requireEnv;
  const runCommand = deps.run ?? run;
  const prepareWrangler = deps.prepareLocalWrangler ?? prepareLocalWrangler;
  const runWrangler = deps.runLocalWrangler ?? runLocalWrangler;

  const values = loadValues();
  requireValues(values, REQUIRED_LOCAL_ADMIN_VALUES);
  if (!argv.includes("--skip-build")) runCommand("npm", ["run", "build"]);
  const commandSpec = prepareWrangler(values);
  return runWrangler(commandSpec);
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
