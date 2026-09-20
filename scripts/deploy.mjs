import { run } from "./env.mjs";

/**
 * Local deployment helper.
 *
 * This command is intentionally non-mutating. Production is deployed only by the
 * protected tag-driven GitHub Actions release path.
 */
run("npm", ["run", "build"]);
run("npx", ["wrangler", "deploy", "--env", "production", "--dry-run"]);
