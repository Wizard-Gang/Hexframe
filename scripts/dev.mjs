import { loadRootEnv, requireEnv, run } from "./env.mjs";
import { startLocalWrangler } from "./dev-secrets.mjs";

const values = loadRootEnv();
requireEnv(values, ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]);
if (!process.argv.includes("--skip-build")) run("npm", ["run", "build"]);
startLocalWrangler(values, { runCommand: run });
