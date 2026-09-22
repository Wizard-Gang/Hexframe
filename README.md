# Hexframe

Hexframe is a browser-based fighting-game training lab. It combines fixed-step combat, authored frame data, replayable state, keyboard and gamepad controls, and integrated training tools.

**[Overview](https://hexframe.wizardgang.ai)** · **[Training](https://hexframe.wizardgang.ai/play/)** · **[Case study](https://wizardgang.ai/projects/hexframe/)**

## Run locally

```bash
npm ci
cp .env.example .env
npm run dev
```

The root route serves the project overview. `/play/` opens the training setup, and `/lab/` is the authenticated developer entry. On macOS and Linux, the dev wrapper owns the detached Wrangler process group it starts: interrupt/termination cleanup re-observes the child and signals the tree only after checkout ownership is proven. An already occupied port 8788 is reported as foreign/unowned and is never killed. Platforms without safe process-ownership inspection are refused before Wrangler is spawned.

## Command and capability map

`npm run check` is the canonical credential-free repository acceptance gate. It does not read
live provider settings and it does not perform a network dependency-advisory query.

| Capability | Invocation | Prerequisite / access | Credentials and network | Mutation boundary | Production? | Ordinary local/PR validation? |
| --- | --- | --- | --- | --- | --- | --- |
| Clean dependency install | `npm ci` | Exact Node/npm versions and committed lockfile | npm registry network; no provider credentials | Replaces local `node_modules`; only version-approved install scripts may run | No | Yes; standard clean-install preparation |
| Repository acceptance | `npm run check` | Dependencies already installed | No provider credentials or provider access required | Runs history, types, tests, build, document/content/security/release-boundary checks; build output is local/ignored | No | Yes; canonical credential-free acceptance |
| Local development | `npm run dev` | Root `.env` with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` | Local app credentials only; no provider credentials required | Builds locally, writes ignored `.dev.vars` with owner-only permissions, then starts owned local Wrangler on port 8788 and cleans its proven process group on wrapper interrupt/termination | No | Local development, not an acceptance gate |
| Dependency advisory | `npm run audit:dependencies` | Committed lockfile; normally run after `npm ci` | npm registry network required; no provider credentials | Runs a read-only `npm audit --json --audit-level=high`; fails on high/critical findings or an unavailable/untrustworthy query | No | Yes; explicit network-backed security gate, separate from `check` |
| Live GitHub settings verification | `GH_ADMIN_TOKEN=$(gh auth token) npm run verify:github-settings` | Repository Administration read access | GitHub token and network required | Reads live repository settings/rulesets and compares them with `config/github-repository-settings.json` | No | Separate read-only provider verification; not ordinary credential-free validation |
| Apply GitHub settings contract | `GH_ADMIN_TOKEN=... npm run apply:github-settings` | Repository Administration write access | GitHub token and network required | Mutates GitHub merge settings/rulesets to the committed contract, then re-reads them | No app deploy | No; privileged provider mutation |
| Production-config dry run | `npm run deploy:dry-run` | Dependencies installed | No provider credentials required | Builds locally and runs `wrangler deploy --env production --dry-run`; nothing is published | No | Yes when production-config validation is relevant |
| Pull-request CI | Automatic on `pull_request` | PR branch current with `main` for merge | GitHub Actions/npm registry access; no production credentials | Runs `npm ci`, canonical `npm run check`, the named network advisory gate, a test-only real local dev start/stop smoke, PR-range `git diff --check`, controlled-title validation, and tracked-secret scanning | No | Yes; required PR validation |
| Release publication | Push an annotated `v<package.json version>` tag | Exact semantic-version tag on the intended commit | GitHub Actions access; workflow uses its GitHub token | Release workflow validates the exact tag, runs `npm ci` and canonical `npm run check` on that tagged checkout, then publishes the GitHub Release and calls the protected deploy workflow | Yes, through the protected deploy stage | No; this is a release action |
| Production deployment | Only the Release workflow calling `.github/workflows/deploy.yml` | Validated immutable release tag and protected `production` environment | Cloudflare production secrets and provider network | Runs real `wrangler deploy --env production`, verifies the live version, and is the only supported production mutation path | Yes | No; protected production mutation only |

Plain local `npm run check` does **not** reproduce every PR-context gate: CI additionally validates
the real local lifecycle smoke, exact PR patch range, the controlled PR title, and the tracked tree
for credential material. Dependency advisory enforcement is intentionally separate from `check` and
runs as the explicit network-backed `npm run audit:dependencies` gate; do not treat `check` itself as
an `npm audit` query.

For release identity and rollback rules, see [Release management](docs/RELEASE-MANAGEMENT.md).

## Structure

- `src/combat/` contains the deterministic combat model.
- `src/game/` and `src/rollback/` contain sessions, snapshots, and replay contracts.
- `src/lab/` contains the training interface and simulation tools.
- `src/client/` contains browser entry points and presentation.
- `src/worker/` contains routing, authentication, and player-save APIs.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Release management](docs/RELEASE-MANAGEMENT.md)

## Deployment

Production releases are deployed from exact semantic-version tags. The running release is published at [version.json](https://hexframe.wizardgang.ai/version.json).
