export function validateReleaseCutterWorkflow(workflow) {
  const failures = [];
  const requireText = (text, message) => {
    if (!workflow.includes(text)) failures.push(message);
  };

  requireText("workflow_run:", "release cutter must be workflow-run driven");
  requireText('workflows: ["CI"]', "release cutter must follow CI only");
  requireText("types: [completed]", "release cutter must wait for completed CI");
  requireText("branches: [main]", "release cutter must be scoped to main");
  if (workflow.includes("workflow_dispatch:")) failures.push("release cutter must not be manually dispatchable");

  requireText("contents: write", "release cutter needs bounded tag write permission");
  requireText("actions: write", "release cutter needs bounded Release dispatch permission");
  requireText("github.event.workflow_run.conclusion == 'success'", "release cutter must require successful CI");
  requireText("github.event.workflow_run.event == 'push'", "release cutter must require main push CI");
  requireText("github.event.workflow_run.head_branch == 'main'", "release cutter must require main");
  requireText("ref: ${{ github.event.workflow_run.head_sha }}", "release cutter must checkout the validated CI SHA");
  requireText("fetch-depth: 0", "release cutter must retain full Git history");
  requireText('current_main="$(git rev-parse origin/main)"', "release cutter must resolve current main");
  requireText('if [ "$current_main" != "$VALIDATED_SHA" ]; then', "release cutter must reject stale CI heads");

  requireText('version="$(node -p "require(\'./package.json\').version")"', "release cutter must derive version from package.json");
  requireText('tag="v$version"', "release cutter must derive the semantic tag from package version");
  requireText('git ls-remote --exit-code --tags origin "refs/tags/$tag"', "release cutter must detect an existing release tag");
  requireText('git cat-file -t "refs/tags/$tag"', "release cutter must verify an existing tag is annotated");
  requireText('echo "cut=false" >> "$GITHUB_OUTPUT"', "release cutter must make existing/stale candidates non-mutating");

  requireText('git tag -a "$TAG" "$VALIDATED_SHA" -m "$TAG"', "release cutter must create an annotated tag on the validated SHA");
  requireText('git push origin "refs/tags/$TAG"', "release cutter must push only the release tag");
  const pushLines = workflow.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("git push origin"));
  if (pushLines.length !== 1 || pushLines[0] !== 'git push origin "refs/tags/$TAG"') failures.push("release cutter must have exactly one non-force tag-only push");
  if (/git push[^\n]*--force/.test(workflow)) failures.push("release cutter must never force-push a tag");
  requireText('"refs/tags/$TAG^{}"', "release cutter must prove the remote tag dereferences as annotated");
  requireText('[ "$remote_commit" = "$VALIDATED_SHA" ]', "release cutter must prove the remote tag resolves to the validated SHA");

  requireText("actions/workflows/release.yml/dispatches", "release cutter must dispatch the existing Release workflow");
  requireText('-f ref="$TAG"', "release cutter must dispatch Release at the exact tag ref");
  requireText("GH_TOKEN: ${{ github.token }}", "release cutter must use only the scoped GitHub Actions token");
  if (/CLOUDFLARE|wrangler|environment:\s*production/i.test(workflow)) failures.push("release cutter must not own provider or production deployment");

  return failures;
}
