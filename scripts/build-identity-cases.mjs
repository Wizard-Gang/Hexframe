import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifact = join(root, "dist", "version.json");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function build() {
  execFileSync(npm, ["run", "build"], { cwd: root, stdio: "inherit" });
  return readFileSync(artifact);
}

const first = build();
await new Promise((resolve) => setTimeout(resolve, 1100));
const second = build();
assert.deepEqual(second, first, "repeated clean builds must emit byte-identical dist/version.json");

const identity = JSON.parse(first.toString("utf8"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const epoch = Number(execFileSync("git", ["show", "-s", "--format=%ct", "HEAD"], { cwd: root, encoding: "utf8" }).trim());
assert.deepEqual(Object.keys(identity), ["product", "release", "commit", "change", "builtAt"]);
assert.equal(identity.commit, commit, "generated identity must name the checkout being built");
assert.equal(identity.builtAt, new Date(epoch * 1000).toISOString(), "builtAt must derive from immutable commit metadata");

console.log(`Reproduced byte-identical ${artifact} twice for ${commit}.`);
