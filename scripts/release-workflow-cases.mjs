import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BASELINE_COMMIT, validateReleaseWorkflow } from "./release-workflow.mjs";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
function replaceRequired(source, from, to) {
  assert.ok(source.includes(from), "fixture is missing expected text: " + from);
  return source.replace(from, to);
}
test("release workflow reproduces and publishes before the pinned baseline deploy", () => {
  assert.deepEqual(validateReleaseWorkflow(workflow), []);
});
test("release workflow keeps only semantic-tag push plus exact-tag dispatch entry paths", () => {
  const broad = replaceRequired(workflow, '      - "v[0-9]+.[0-9]+.[0-9]+"', '      - "v*"');
  assert.match(validateReleaseWorkflow(broad).join("\n"), /semantic vX\.Y\.Z tags/);
  const noDispatch = replaceRequired(workflow, "  workflow_dispatch:\n", "");
  assert.match(validateReleaseWorkflow(noDispatch).join("\n"), /semantic tag push and exact-tag workflow dispatch/);
});
test("release reproduction keeps exact identity and canonical acceptance", () => {
  const noIdentity = replaceRequired(workflow, 'npm run verify:release-identity -- --tag "$GITHUB_REF_NAME" --ref-type "$GITHUB_REF_TYPE" --fetch-origin', "echo skipped");
  assert.match(validateReleaseWorkflow(noIdentity).join("\n"), /verify exact release identity/);
  const noCheck = replaceRequired(workflow, "          npm run check\n", "");
  assert.match(validateReleaseWorkflow(noCheck).join("\n"), /canonical npm run check/);
});
test("production uses the exact baseline pin and immutable release identity", () => {
  const stale = replaceRequired(workflow, `deploy-worker.yml@${BASELINE_COMMIT}`, "deploy-worker.yml@0000000000000000000000000000000000000000");
  assert.match(validateReleaseWorkflow(stale).join("\n"), /pinned baseline deploy-worker/);
  const wrongWorker = replaceRequired(workflow, "      worker: hexframe", "      worker: demo");
  assert.match(validateReleaseWorkflow(wrongWorker).join("\n"), /worker hexframe/);
  const wrongSha = replaceRequired(workflow, "      expected_sha: ${{ github.sha }}", "      expected_sha: deadbeef");
  assert.match(validateReleaseWorkflow(wrongSha).join("\n"), /exact tagged commit/);
});
test("baseline deploy receives protected caller secrets without embedding deploy steps", () => {
  const noSecrets = replaceRequired(workflow, "    secrets: inherit\n", "");
  assert.match(validateReleaseWorkflow(noSecrets).join("\n"), /inherit the caller's protected environment secret/);
  const embedded = replaceRequired(workflow, "    secrets: inherit", "    secrets: inherit\n    runs-on: ubuntu-latest");
  assert.match(validateReleaseWorkflow(embedded).join("\n"), /must not embed production deployment steps/);
});
