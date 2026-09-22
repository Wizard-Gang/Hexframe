/**
 * SHARED WIZARDGANG TEMPLATE — build-time deployment identity.
 *
 * Writes `version.json` into the build output so the running system can state exactly
 * which code it is. Clean build identity is derived only from the checked-out commit,
 * an exact annotated release tag at that commit, and explicit deterministic inputs.
 *
 * Usage:  node scripts/version-stamp.mjs <product> <outDir>
 * Env:    RELEASE  optional exact annotated semantic-version tag for the checked-out commit
 *         CHANGE   optional controlled change ID this build carries
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [product = "Unknown", outDir = "dist"] = process.argv.slice(2);

const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const commit = git("rev-parse", "HEAD") || "unknown";
const dirty = git("status", "--porcelain") !== "";
const commitEpoch = git("show", "-s", "--format=%ct", "HEAD");
const builtAt = /^\d+$/.test(commitEpoch)
  ? new Date(Number(commitEpoch) * 1000).toISOString()
  : "1970-01-01T00:00:00.000Z";

const exactTags = git("tag", "--points-at", "HEAD", "--sort=-version:refname")
  .split("\n")
  .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
  .filter((tag) => git("cat-file", "-t", `refs/tags/${tag}`) === "tag");

const requestedRelease = process.env.RELEASE?.trim() || "";
let release = exactTags[0] || "0.0.0-dev";
if (requestedRelease) {
  if (!/^v\d+\.\d+\.\d+$/.test(requestedRelease)) {
    throw new Error(`RELEASE must be an exact semantic-version tag, received ${requestedRelease}`);
  }
  if (git("cat-file", "-t", `refs/tags/${requestedRelease}`) !== "tag") {
    throw new Error(`RELEASE ${requestedRelease} must be an annotated tag`);
  }
  const taggedCommit = git("rev-parse", `refs/tags/${requestedRelease}^{}`);
  if (!taggedCommit || taggedCommit !== commit) {
    throw new Error(`RELEASE ${requestedRelease} does not name checked-out commit ${commit}`);
  }
  release = requestedRelease;
}

const identity = {
  product,
  release: dirty ? `${release}+dirty` : release,
  commit,
  change: process.env.CHANGE || null,
  builtAt,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "version.json"), JSON.stringify(identity, null, 2) + "\n");
console.log(`version.json → ${outDir}`, identity);
