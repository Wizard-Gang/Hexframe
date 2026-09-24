import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const baseline = {
  release: read(".github/workflows/release.yml"),
  deploy: read(".github/workflows/deploy.yml"),
  deployCli: read("scripts/deploy.mjs"),
  versionStamp: read("scripts/version-stamp.mjs"),
};

function requireText(failures, source, text, message) {
  if (!source.includes(text)) failures.push(message);
}

function validateReleaseDeployContract({ release, deploy, deployCli, versionStamp }) {
  const failures = [];

  requireText(
    failures,
    release,
    'gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"',
    "GitHub Release publication must verify and publish the exact event tag",
  );
  requireText(failures, release, "    needs: reproduce", "production deploy must wait for successful GitHub Release publication");
  requireText(failures, release, "    uses: ./.github/workflows/deploy.yml", "release must delegate production to the reusable deploy workflow");
  requireText(failures, release, "      tag: ${{ github.ref_name }}", "release must hand the exact event tag to production deploy");

  requireText(failures, deploy, "    environment: production", "production deploy must remain in the protected production environment");
  requireText(failures, deploy, "          ref: ${{ github.ref }}", "production checkout must use the immutable caller tag ref");
  requireText(failures, deploy, "          fetch-depth: 0", "production checkout must retain full tag history");
  requireText(failures, deploy, "          EXPECTED_TAG: ${{ inputs.tag }}", "deploy CLI must receive the exact release handoff tag");
  requireText(failures, deploy, '        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"', "public identity must resolve the deployed checkout commit");
  requireText(failures, deploy, "        run: npm run deploy:production", "production mutation must remain behind the guarded npm CLI");
  requireText(failures, deploy, "          RELEASE: ${{ github.ref_name }}", "public identity must compare the exact event tag");
  requireText(failures, deploy, "          COMMIT: ${{ steps.target.outputs.sha }}", "public identity must compare the resolved deployed commit");
  requireText(failures, deploy, '"https://$HOST/version.json"', "deploy must query public version.json evidence");
  requireText(failures, deploy, "jq -r .release", "public identity must compare version.json release");
  requireText(failures, deploy, "jq -r .commit", "public identity must compare version.json commit");
  requireText(failures, deploy, "^cf-mitigated: *challenge", "Cloudflare managed challenge must be the explicit public-evidence exception");
  requireText(failures, deploy, "::error::could not read https://$HOST/version.json", "ordinary public identity retrieval failure must fail closed");
  if (deploy.includes("::warning::could not read https://$HOST/version.json")) {
    failures.push("ordinary public identity retrieval failure must not be downgraded to a warning");
  }

  requireText(failures, deployCli, "GITHUB_REF_NAME", "guarded deploy must derive the event tag from GitHub Actions");
  requireText(failures, deployCli, "GITHUB_REF", "guarded deploy must bind the exact event ref");
  requireText(failures, deployCli, "EXPECTED_TAG", "guarded deploy must bind the caller release tag");
  requireText(failures, deployCli, "verify:release-identity", "guarded deploy must re-run immutable release identity validation");
  requireText(failures, deployCli, "RELEASE: tag", "release build must stamp the validated tag into version.json");
  requireText(failures, deployCli, '["wrangler", "deploy", "--env", "production"]', "guarded deploy must capture the uploaded Cloudflare version");
  requireText(failures, deployCli, '["wrangler", "deployments", "list", "--env", "production"]', "guarded deploy must query authenticated deployment state");
  requireText(failures, deployCli, "assertDeployedVersionLive(deploymentsOutput, version)", "authenticated deployment evidence must prove the uploaded version is serving 100% of traffic");

  requireText(failures, versionStamp, 'const commit = git("rev-parse", "HEAD")', "version.json must derive commit identity from the checked-out commit");
  requireText(failures, versionStamp, "taggedCommit !== commit", "version stamp must reject a release tag that names another commit");
  requireText(failures, versionStamp, 'writeFileSync(join(outDir, "version.json")', "build identity must emit version.json");

  return failures;
}

function mutate(key, from, to) {
  const changed = { ...baseline };
  assert.ok(changed[key].includes(from), `fixture is missing expected text: ${from}`);
  changed[key] = changed[key].replace(from, to);
  return changed;
}

test("release-to-deploy chain binds publication, deployment, provider evidence, and public identity", () => {
  assert.deepEqual(validateReleaseDeployContract(baseline), []);
});

test("release publication and handoff drift fail the contract", () => {
  const wrongDependency = mutate("release", "    needs: reproduce", "    needs: verify");
  assert.match(validateReleaseDeployContract(wrongDependency).join("\n"), /successful GitHub Release publication/);

  const wrongTag = mutate("release", "      tag: ${{ github.ref_name }}", "      tag: v0.0.0");
  assert.match(validateReleaseDeployContract(wrongTag).join("\n"), /exact event tag/);
});

test("protected environment and immutable checkout drift fail the contract", () => {
  const wrongEnvironment = mutate("deploy", "    environment: production", "    environment: staging");
  assert.match(validateReleaseDeployContract(wrongEnvironment).join("\n"), /protected production environment/);

  const wrongRef = mutate("deploy", "          ref: ${{ github.ref }}", "          ref: ${{ inputs.tag }}");
  assert.match(validateReleaseDeployContract(wrongRef).join("\n"), /immutable caller tag ref/);
});

test("authenticated Cloudflare live-version drift fails the contract", () => {
  const changed = mutate(
    "deployCli",
    "assertDeployedVersionLive(deploymentsOutput, version)",
    "deploymentsOutput",
  );
  assert.match(validateReleaseDeployContract(changed).join("\n"), /serving 100% of traffic/);
});

test("public version identity must fail closed except for a managed challenge", () => {
  const wrongCommit = mutate("deploy", "          COMMIT: ${{ steps.target.outputs.sha }}", "          COMMIT: ${{ github.sha }}");
  assert.match(validateReleaseDeployContract(wrongCommit).join("\n"), /resolved deployed commit/);

  const warning = mutate(
    "deploy",
    "::error::could not read https://$HOST/version.json",
    "::warning::could not read https://$HOST/version.json",
  );
  assert.match(validateReleaseDeployContract(warning).join("\n"), /fail closed|must not be downgraded/);
});

test("release build identity cannot drift away from the validated tag and commit", () => {
  const wrongRelease = mutate("deployCli", "RELEASE: tag", 'RELEASE: "v0.0.0"');
  assert.match(validateReleaseDeployContract(wrongRelease).join("\n"), /stamp the validated tag/);

  const weakStamp = mutate("versionStamp", "taggedCommit !== commit", "taggedCommit === commit");
  assert.match(validateReleaseDeployContract(weakStamp).join("\n"), /another commit/);
});
