import { spawnSync } from "node:child_process";

function runGit(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

const base = String(process.env.PATCH_BASE_SHA ?? "").trim();
const head = String(process.env.PATCH_HEAD_SHA ?? "").trim();

if (Boolean(base) !== Boolean(head)) {
  console.error("PATCH_BASE_SHA and PATCH_HEAD_SHA must be provided together");
  process.exit(1);
}

if (!base) {
  console.log("No explicit committed patch range supplied; committed-range patch integrity skipped.");
  process.exit(0);
}

for (const [name, sha] of [["PATCH_BASE_SHA", base], ["PATCH_HEAD_SHA", head]]) {
  const verified = runGit(process.cwd(), ["rev-parse", "--verify", `${sha}^{commit}`]);
  if (verified.status !== 0) {
    console.error(`${name} does not name a commit: ${sha}`);
    process.exit(1);
  }
}

const range = `${base}..${head}`;
const checked = runGit(process.cwd(), ["diff", "--check", range]);
if (checked.status !== 0) {
  if (checked.stdout) process.stderr.write(checked.stdout);
  if (checked.stderr) process.stderr.write(checked.stderr);
  console.error(`Patch integrity failed for ${range}`);
  process.exit(1);
}

console.log(`Patch integrity passed for ${range}.`);
