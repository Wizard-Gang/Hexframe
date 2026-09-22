import { resolve } from "node:path";

export const LOCAL_WRANGLER_PORT = "8788";

function isPositivePid(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isWranglerToken(value) {
  if (typeof value !== "string") return false;
  const normalized = value.replaceAll("\\", "/").replace(/^["']|["']$/g, "").toLowerCase();
  return normalized === "wrangler"
    || normalized.endsWith("/wrangler")
    || normalized.endsWith("/wrangler.js");
}

function hasExpectedWranglerCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((value) => typeof value !== "string")) {
    return false;
  }

  const wranglerIndex = argv.findIndex(isWranglerToken);
  if (wranglerIndex < 0) return false;

  const tail = argv.slice(wranglerIndex + 1);
  const devIndex = tail.indexOf("dev");
  if (devIndex < 0) return false;

  const portIndex = tail.indexOf("--port", devIndex + 1);
  return portIndex >= 0 && tail[portIndex + 1] === LOCAL_WRANGLER_PORT;
}

export function isOwnedLocalWrangler(expected, observed) {
  if (!expected || !observed) return false;
  if (!isPositivePid(expected.pid) || !isPositivePid(expected.parentPid)) return false;
  if (observed.alive !== true) return false;
  if (observed.pid !== expected.pid || observed.parentPid !== expected.parentPid) return false;

  if (
    typeof expected.rootDir !== "string"
    || expected.rootDir.length === 0
    || typeof observed.cwd !== "string"
    || observed.cwd.length === 0
  ) {
    return false;
  }

  if (resolve(observed.cwd) !== resolve(expected.rootDir)) return false;
  return hasExpectedWranglerCommand(observed.argv);
}
