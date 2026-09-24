import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT_DIR } from "./env.mjs";

const REPOSITORY = "Wizard-Gang/Hexframe";
const VERSION_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function parseMode(args) {
  if (args.length !== 1 || !["--dry-run", "--production"].includes(args[0])) {
    throw new Error("deploy requires exactly one mode: --dry-run or --production");
  }
  return args[0];
}

function required(env, key) {
  const value = String(env[key] ?? "").trim();
  if (!value) throw new Error(`${key} is required for production deployment`);
  return value;
}

export function assertProductionContext(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true") {
    throw new Error("production deployment is supported only in GitHub Actions");
  }
  if (env.GITHUB_EVENT_NAME !== "push") {
    throw new Error(`production deployment requires the release tag push event, received ${env.GITHUB_EVENT_NAME || "unknown"}`);
  }
  if (env.GITHUB_REPOSITORY !== REPOSITORY) {
    throw new Error(`production deployment requires ${REPOSITORY}, received ${env.GITHUB_REPOSITORY || "unknown"}`);
  }

  const tag = required(env, "GITHUB_REF_NAME");
  if (env.GITHUB_REF_TYPE !== "tag") {
    throw new Error(`production deployment requires a tag ref, received ${env.GITHUB_REF_TYPE || "unknown"}`);
  }
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    throw new Error(`${tag} is not an exact semantic-version release tag`);
  }
  if (env.GITHUB_REF !== `refs/tags/${tag}`) {
    throw new Error(`production deployment requires refs/tags/${tag}, received ${env.GITHUB_REF || "unknown"}`);
  }

  const expectedTag = required(env, "EXPECTED_TAG");
  if (expectedTag !== tag) {
    throw new Error(`expected tag ${expectedTag} does not match release tag ${tag}`);
  }

  required(env, "CLOUDFLARE_API_TOKEN");
  required(env, "CLOUDFLARE_ACCOUNT_ID");
  return tag;
}

export function extractVersionId(output) {
  const matches = String(output).match(VERSION_ID) ?? [];
  const version = matches.at(-1);
  if (!version) throw new Error("could not read the deployed Version ID from wrangler output");
  return version;
}

export function assertDeployedVersionLive(output, version) {
  const newest = String(output)
    .split(/\r?\n/)
    .filter((line) => /^Version\(s\):/.test(line.trim()))
    .at(-1);

  if (!newest) throw new Error("could not read the newest deployment from wrangler output");
  if (!newest.includes(version)) throw new Error(`the live deployment is not ${version}`);
  if (!newest.includes("(100%)")) throw new Error(`${version} is not serving 100% of traffic`);
  return newest;
}

export function runCommand(command, args, { env = process.env, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
  });

  if (result.error) throw result.error;

  const output = capture ? `${result.stdout ?? ""}${result.stderr ?? ""}` : "";
  if (capture && output) process.stdout.write(output);

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}`);
  }

  return output;
}

export function runDryRun({ run = runCommand } = {}) {
  run("npm", ["run", "build"]);
  run("npx", ["wrangler", "deploy", "--env", "production", "--dry-run"]);
}

export function runProduction({ env = process.env, run = runCommand } = {}) {
  const tag = assertProductionContext(env);
  const expectedTag = String(env.EXPECTED_TAG).trim();

  const nonProviderEnv = { ...env };
  delete nonProviderEnv.CLOUDFLARE_API_TOKEN;
  delete nonProviderEnv.CLOUDFLARE_ACCOUNT_ID;

  run(
    "npm",
    [
      "run",
      "verify:release-identity",
      "--",
      "--tag",
      tag,
      "--expected-tag",
      expectedTag,
      "--ref-type",
      String(env.GITHUB_REF_TYPE),
      "--fetch-origin",
    ],
    { env: nonProviderEnv },
  );

  run("npm", ["run", "build"], {
    env: { ...nonProviderEnv, RELEASE: tag },
  });

  const deployOutput = run("npx", ["wrangler", "deploy", "--env", "production"], {
    env,
    capture: true,
  });
  const version = extractVersionId(deployOutput);

  const deploymentsOutput = run("npx", ["wrangler", "deployments", "list", "--env", "production"], {
    env,
    capture: true,
  });
  const newest = assertDeployedVersionLive(deploymentsOutput, version);

  console.log(`Production is serving ${version} at 100%`);
  return { tag, version, newest };
}

export function main(args = process.argv.slice(2)) {
  const mode = parseMode(args);
  if (mode === "--dry-run") {
    runDryRun();
    return;
  }
  runProduction();
}

const isEntryPoint = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntryPoint) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`deployment failed: ${message}`);
    process.exitCode = 1;
  }
}
