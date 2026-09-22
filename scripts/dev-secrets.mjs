import { chmodSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT_DIR } from "./env.mjs";
import { LOCAL_WRANGLER_PORT } from "./dev-process-ownership.mjs";

export const LOCAL_DEV_VARS_PATH = resolve(ROOT_DIR, ".dev.vars");
export const LOCAL_WRANGLER_CLI_PATH = resolve(ROOT_DIR, "node_modules", "wrangler", "bin", "wrangler.js");

export function writeLocalDevSecrets(values, path = LOCAL_DEV_VARS_PATH) {
  const source = [
    `ADMIN_USERNAME=${JSON.stringify(values.ADMIN_USERNAME)}`,
    `ADMIN_PASSWORD=${JSON.stringify(values.ADMIN_PASSWORD)}`,
    `ADMIN_SESSION_SECRET=${JSON.stringify(values.ADMIN_SESSION_SECRET)}`,
    "",
  ].join("\n");
  writeFileSync(path, source, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

export function prepareLocalWrangler(values, { secretPath = LOCAL_DEV_VARS_PATH, rootDir = ROOT_DIR } = {}) {
  writeLocalDevSecrets(values, secretPath);
  return {
    command: process.execPath,
    args: [resolve(rootDir, "node_modules", "wrangler", "bin", "wrangler.js"), "dev", "--port", LOCAL_WRANGLER_PORT],
  };
}
