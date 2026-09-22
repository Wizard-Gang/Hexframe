import { chmodSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT_DIR } from "./env.mjs";

export const LOCAL_DEV_VARS_PATH = resolve(ROOT_DIR, ".dev.vars");

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

export function startLocalWrangler(values, { runCommand, secretPath = LOCAL_DEV_VARS_PATH } = {}) {
  if (typeof runCommand !== "function") throw new TypeError("runCommand is required");
  writeLocalDevSecrets(values, secretPath);
  runCommand("npx", ["wrangler", "dev", "--port", "8788"]);
}
