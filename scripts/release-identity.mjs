import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function parseArgs(args) {
  const options = {
    tag: "",
    expectedTag: "",
    refType: "",
    fetchOrigin: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--fetch-origin") {
      options.fetchOrigin = true;
      continue;
    }

    if (["--tag", "--expected-tag", "--ref-type"].includes(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      if (arg === "--tag") options.tag = value;
      if (arg === "--expected-tag") options.expectedTag = value;
      if (arg === "--ref-type") options.refType = value;
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

const cwd = process.cwd();
const git = (...args) => execFileSync("git", args, {
  cwd,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();

try {
  const options = parseArgs(process.argv.slice(2));
  const tag = options.tag.trim();

  if (!tag) {
    throw new Error("--tag is required");
  }
  if (options.refType && options.refType !== "tag") {
    throw new Error(`release identity requires a tag ref, received ${options.refType}`);
  }
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`${tag} is not an exact semantic-version release tag`);
  }
  if (options.expectedTag && options.expectedTag !== tag) {
    throw new Error(`expected tag ${options.expectedTag} does not match release tag ${tag}`);
  }

  const tagRef = `refs/tags/${tag}`;
  if (options.fetchOrigin) {
    git("fetch", "--force", "--no-tags", "origin", `${tagRef}:${tagRef}`);
  }

  if (git("cat-file", "-t", tagRef) !== "tag") {
    throw new Error(`${tag} is not an annotated tag`);
  }

  const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  const packageVersion = String(pkg.version ?? "").trim();
  if (tag !== `v${packageVersion}`) {
    throw new Error(`tag ${tag} does not match package version v${packageVersion}`);
  }

  const taggedCommit = git("rev-parse", `${tagRef}^{}`);
  const checkedOutCommit = git("rev-parse", "HEAD");
  if (taggedCommit !== checkedOutCommit) {
    throw new Error(`checked out commit ${checkedOutCommit} is not tagged commit ${taggedCommit}`);
  }

  console.log(`Verified release identity ${tag} @ ${checkedOutCommit}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`release identity verification failed: ${message}`);
  process.exitCode = 1;
}
