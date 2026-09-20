import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts ?? {};

assert.equal(scripts.deploy, undefined, "normal package scripts must not expose a production deploy");
assert.equal(scripts["secrets:push"], undefined, "normal package scripts must not expose production secret mutation");
assert.equal(scripts["deploy:dry-run"], "node scripts/deploy.mjs");
for (const [name, command] of Object.entries(scripts)) {
  assert.doesNotMatch(String(command), /wrangler\s+secret\s+put/i, `${name} mutates production secrets`);
  if (name !== "deploy:dry-run") {
    assert.doesNotMatch(String(command), /wrangler\s+deploy/i, `${name} deploys directly`);
  }
}

const localDeploy = read("scripts/deploy.mjs");
assert.match(localDeploy, /"--dry-run"/, "local deploy helper must be dry-run only");
assert.doesNotMatch(localDeploy, /sync-secrets|CLOUDFLARE_API_TOKEN|ADMIN_PASSWORD|ADMIN_SESSION_SECRET/);
assert.match(localDeploy, /"production"/, "dry run should validate production configuration");

const localSecrets = read("scripts/sync-secrets.mjs");
assert.doesNotMatch(localSecrets, /wrangler|secret\s+put|loadRootEnv|CLOUDFLARE/i, "local secret helper must not mutate provider state");

const release = read(".github/workflows/release.yml");
assert.match(release, /push:\s*\n\s+tags:\s*\['v\*'\]/);
assert.doesNotMatch(release, /workflow_dispatch:/, "release workflow must not be manually dispatchable");
assert.match(release, /git cat-file -t/);
assert.match(release, /package_version=.*package\.json/);
assert.match(release, /GITHUB_REF_NAME.*v\$package_version|v\$package_version.*GITHUB_REF_NAME/s);
assert.match(release, /gh release create/);
assert.match(release, /--generate-notes/, "GitHub must generate human-readable release notes from repository state");
assert.match(release, /--verify-tag/);
assert.doesNotMatch(release, /docs\/releases|CHANGELOG\.md|--notes-file/, "release workflow must not depend on checked-in release history");
assert.match(release, /uses:\s*\.\/\.github\/workflows\/deploy\.yml/);
assert.match(release, /tag:\s*\$\{\{ github\.ref_name \}\}/);

const deploy = read(".github/workflows/deploy.yml");
assert.match(deploy, /workflow_call:/);
assert.doesNotMatch(deploy, /workflow_dispatch:/, "production deploy must not be manually dispatchable");
assert.match(deploy, /environment:\s*production/);
assert.match(deploy, /ref:\s*\$\{\{ github\.ref \}\}/, "deploy must checkout the caller's immutable tag ref");
assert.match(deploy, /GITHUB_REF_TYPE.*tag/);
assert.match(deploy, /GITHUB_REF_NAME.*EXPECTED_TAG/);
assert.match(deploy, /git cat-file -t/);
assert.match(deploy, /package_version=.*package\.json/);
assert.match(deploy, /wrangler deploy --env production/);

const workflows = readdirSync(join(root, ".github/workflows")).filter((name) => name.endsWith(".yml"));
const deployCallers = workflows.filter((name) => name !== "deploy.yml" && read(`.github/workflows/${name}`).includes("uses: ./.github/workflows/deploy.yml"));
assert.deepEqual(deployCallers, ["release.yml"], "only the release workflow may call the production deploy workflow");

assert.equal(existsSync(join(root, "CHANGELOG.md")), false, "checked-in CHANGELOG.md is not a release-history authority");
assert.equal(existsSync(join(root, "docs/releases")), false, "per-version Markdown release archive is not maintained");

const releasePolicy = read("docs/RELEASE-MANAGEMENT.md");
assert.match(releasePolicy, /GitHub Releases are the human-readable release-history authority/i);
assert.match(releasePolicy, /Actions runs carry release validation evidence/i);
assert.match(releasePolicy, /provider deployment history carries runtime deployment evidence/i);
assert.match(releasePolicy, /CHANGELOG\.md.*not maintained|not maintained.*CHANGELOG\.md/is);

const docsToCheck = [
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "docs/RELEASE-MANAGEMENT.md",
];
for (const path of docsToCheck) {
  const source = read(path);
  assert.doesNotMatch(source, /\]\([^)]*(?:docs\/releases\/|CHANGELOG\.md)[^)]*\)/, `${path} links to retired checked-in release history`);
}

console.log("Validated immutable release-only production mutation and GitHub release-history authority.");
