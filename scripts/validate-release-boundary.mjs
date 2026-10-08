import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts ?? {};
const lock = JSON.parse(read("platform/vendor.lock.json"));

assert.equal(lock.source, "Wizard-Gang/baseline");
assert.equal(lock.commit, "7a5e351639e801999554130e346bfa65a3807585");
assert.equal(scripts["check:platform"], "node platform/conformance/cli.mjs pin && node platform/conformance/cli.mjs wrangler --worker hexframe");
assert.match(String(scripts.check), /npm run check:platform/);
for (const retired of ["deploy", "deploy:dry-run", "deploy:production", "test:deploy", "test:release-deploy-contract"]) {
  assert.equal(scripts[retired], undefined, `${retired} must not expose a repository-local production deploy path`);
}
for (const path of [".github/workflows/deploy.yml", "scripts/deploy.mjs", "scripts/deploy-cases.mjs", "scripts/release-deploy-contract-cases.mjs"]) {
  assert.equal(existsSync(join(root, path)), false, `${path} is retired`);
}
const release = read(".github/workflows/release.yml");
assert.match(release, /push:\s*\n\s+tags:\s*\n\s+- "v\[0-9\]\+\.\[0-9\]\+\.\[0-9\]\+"/);
assert.match(release, /workflow_dispatch:/);
assert.match(release, /npm run verify:release-identity -- --tag "\$GITHUB_REF_NAME" --ref-type "\$GITHUB_REF_TYPE" --fetch-origin/);
assert.match(release, /gh release create/);
assert.match(release, /--generate-notes/);
assert.match(release, /--verify-tag/);
assert.match(release, new RegExp(`uses: Wizard-Gang/baseline/\\.github/workflows/deploy-worker\\.yml@${lock.commit}`));
assert.match(release, /worker:\s*hexframe/);
assert.match(release, /tag:\s*\$\{\{ github\.ref_name \}\}/);
assert.match(release, /expected_sha:\s*\$\{\{ github\.sha \}\}/);
assert.match(release, /secrets:\s*inherit/);
assert.doesNotMatch(release, /PRODUCTION_HOST|secrets\.CLOUDFLARE_ACCOUNT_ID|wrangler\s+deploy/i);
const releaseIdentity = read("scripts/release-identity.mjs");
assert.doesNotMatch(releaseIdentity, /GH_TOKEN|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|wrangler\s+deploy|gh\s+release\s+create/i);
const cutter = read(".github/workflows/release-cutter.yml");
assert.match(cutter, /workflow_run:/);
assert.match(cutter, /workflows: \["CI"\]/);
assert.match(cutter, /branches: \[main\]/);
assert.doesNotMatch(cutter, /workflow_dispatch:/);
assert.match(cutter, /git tag -a/);
assert.match(cutter, /actions\/workflows\/release\.yml\/dispatches/);
assert.doesNotMatch(cutter, /CLOUDFLARE|wrangler|environment:\s*production/i);
const wrangler = read("wrangler.jsonc");
assert.match(wrangler, /"WG_APP": "hexframe"/);
assert.match(wrangler, /"hexframe\.wizardgang\.ai"/);
assert.match(wrangler, /"WG_OPS_TOKEN"/);
assert.match(wrangler, /"WG_SESSION_KEY"/);
assert.doesNotMatch(wrangler, /"env"\s*:|d1_databases|r2_buckets|kv_namespaces|CLOUDFLARE_ACCOUNT_ID|ENVIRONMENT/);
console.log("Validated the shared baseline shell and single release-only production deployment boundary.");
