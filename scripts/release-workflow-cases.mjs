import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateReleaseWorkflow } from "./release-workflow.mjs";

const releasePath = new URL("../.github/workflows/release.yml", import.meta.url);
const workflow = readFileSync(releasePath, "utf8");

function replaceRequired(source, from, to) {
  assert.ok(source.includes(from), "fixture is missing expected text: " + from);
  return source.replace(from, to);
}

function swapRequired(source, first, second) {
  assert.ok(source.includes(first), "fixture is missing expected text: " + first);
  assert.ok(source.includes(second), "fixture is missing expected text: " + second);
  return source
    .replace(first, "__FIRST__")
    .replace(second, first)
    .replace("__FIRST__", second);
}

test("release workflow orders identity, clean reproduction, publication, then deployment", () => {
  assert.deepEqual(validateReleaseWorkflow(workflow), []);
});

test("release workflow remains exact semantic-tag driven only", () => {
  const changed = replaceRequired(workflow, '      - "v[0-9]+.[0-9]+.[0-9]+"', '      - "v*"');
  assert.match(validateReleaseWorkflow(changed).join("\n"), /target only semantic vX\.Y\.Z tags/);
});

test("release reproduction keeps full Git and tag history", () => {
  const changed = replaceRequired(workflow, "          fetch-depth: 0", "          fetch-depth: 1");
  assert.match(validateReleaseWorkflow(changed).join("\n"), /checkout full Git\/tag history/);
});

test("publication cannot run before release identity verification", () => {
  const identity = 'npm run verify:release-identity -- --tag "$GITHUB_REF_NAME" --ref-type "$GITHUB_REF_TYPE" --fetch-origin';
  const publish = 'gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"';
  const changed = swapRequired(workflow, identity, publish);
  assert.match(validateReleaseWorkflow(changed).join("\n"), /clean npm ci must run after release identity verification|publication must follow successful canonical acceptance/);
});

test("release reproduction cannot omit clean install or canonical acceptance", () => {
  const withoutInstall = replaceRequired(workflow, "          npm ci\n", "");
  assert.match(validateReleaseWorkflow(withoutInstall).join("\n"), /clean npm ci install/);

  const withoutCheck = replaceRequired(workflow, "          npm run check\n", "");
  assert.match(validateReleaseWorkflow(withoutCheck).join("\n"), /canonical npm run check/);
});

test("publication must verify the exact existing tag", () => {
  const changed = replaceRequired(
    workflow,
    'gh release create "$GITHUB_REF_NAME" --verify-tag --generate-notes --title "$GITHUB_REF_NAME"',
    'gh release create "$GITHUB_REF_NAME" --generate-notes --title "$GITHUB_REF_NAME"',
  );
  assert.match(validateReleaseWorkflow(changed).join("\n"), /publish the exact existing tag/);
});

test("production cannot begin before successful reproduction and publication", () => {
  const changed = replaceRequired(workflow, "    needs: reproduce", "    needs: verify");
  assert.match(validateReleaseWorkflow(changed).join("\n"), /depend on successful reproduction and publication/);
});

test("release workflow passes the exact event tag to reusable production", () => {
  const changed = replaceRequired(workflow, "      tag: ${{ github.ref_name }}", "      tag: v0.0.0");
  assert.match(validateReleaseWorkflow(changed).join("\n"), /receive the exact release event tag/);
});
