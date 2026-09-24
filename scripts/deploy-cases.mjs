import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDeployedVersionLive,
  assertProductionContext,
  extractVersionId,
  parseMode,
  runDryRun,
  runProduction,
} from "./deploy.mjs";

const version = "12345678-1234-1234-1234-123456789abc";

function productionEnv(overrides = {}) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REPOSITORY: "Wizard-Gang/Hexframe",
    GITHUB_REF_TYPE: "tag",
    GITHUB_REF_NAME: "v0.7.9",
    GITHUB_REF: "refs/tags/v0.7.9",
    EXPECTED_TAG: "v0.7.9",
    CLOUDFLARE_API_TOKEN: "test-token",
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    ...overrides,
  };
}

test("deploy mode must be explicit", () => {
  assert.equal(parseMode(["--dry-run"]), "--dry-run");
  assert.equal(parseMode(["--production"]), "--production");
  assert.throws(() => parseMode([]), /exactly one mode/);
  assert.throws(() => parseMode(["--production", "--dry-run"]), /exactly one mode/);
  assert.throws(() => parseMode(["--other"]), /exactly one mode/);
});

test("dry run builds and invokes only Wrangler dry-run deployment", () => {
  const calls = [];
  runDryRun({
    run(command, args) {
      calls.push([command, args]);
      return "";
    },
  });

  assert.deepEqual(calls, [
    ["npm", ["run", "build"]],
    ["npx", ["wrangler", "deploy", "--env", "production", "--dry-run"]],
  ]);
});

test("production context rejects local, branch, mismatched-tag, and missing-credential calls", () => {
  assert.throws(
    () => assertProductionContext(productionEnv({ GITHUB_ACTIONS: "" })),
    /only in GitHub Actions/,
  );
  assert.throws(
    () => assertProductionContext(productionEnv({ GITHUB_REF_TYPE: "branch", GITHUB_REF: "refs/heads/main" })),
    /requires a tag ref/,
  );
  assert.throws(
    () => assertProductionContext(productionEnv({ EXPECTED_TAG: "v0.7.8" })),
    /does not match release tag/,
  );
  assert.throws(
    () => assertProductionContext(productionEnv({ CLOUDFLARE_API_TOKEN: "" })),
    /CLOUDFLARE_API_TOKEN is required/,
  );
});

test("production deploy validates identity before build and provider mutation", () => {
  const calls = [];
  const env = productionEnv();

  const result = runProduction({
    env,
    run(command, args, options = {}) {
      calls.push({ command, args, options });
      if (args[0] === "wrangler" && args[1] === "deploy") {
        return `Uploaded worker\nVersion ID: ${version}\n`;
      }
      if (args[0] === "wrangler" && args[1] === "deployments") {
        return `Created: now\nVersion(s): (100%) ${version}\n`;
      }
      return "";
    },
  });

  assert.equal(result.tag, "v0.7.9");
  assert.equal(result.version, version);
  assert.deepEqual(
    calls.map(({ command, args }) => [command, args]),
    [
      [
        "npm",
        [
          "run",
          "verify:release-identity",
          "--",
          "--tag",
          "v0.7.9",
          "--expected-tag",
          "v0.7.9",
          "--ref-type",
          "tag",
          "--fetch-origin",
        ],
      ],
      ["npm", ["run", "build"]],
      ["npx", ["wrangler", "deploy", "--env", "production"]],
      ["npx", ["wrangler", "deployments", "list", "--env", "production"]],
    ],
  );

  const identityEnv = calls[0].options.env;
  const buildEnv = calls[1].options.env;
  assert.equal(identityEnv.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(identityEnv.CLOUDFLARE_ACCOUNT_ID, undefined);
  assert.equal(buildEnv.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(buildEnv.CLOUDFLARE_ACCOUNT_ID, undefined);
  assert.equal(buildEnv.RELEASE, "v0.7.9");
  assert.equal(calls[2].options.capture, true);
  assert.equal(calls[3].options.capture, true);
});

test("version parsing and live deployment verification fail closed", () => {
  assert.equal(extractVersionId(`Version ID: ${version}`), version);
  assert.throws(() => extractVersionId("uploaded without identity"), /could not read/);

  assert.match(
    assertDeployedVersionLive(`Version(s): (100%) ${version}\n`, version),
    /100%/,
  );
  assert.throws(
    () => assertDeployedVersionLive("Version(s): (100%) deadbeef-dead-beef-dead-beefdeadbeef", version),
    /live deployment is not/,
  );
  assert.throws(
    () => assertDeployedVersionLive(`Version(s): (50%) ${version}\n`, version),
    /not serving 100%/,
  );
});
