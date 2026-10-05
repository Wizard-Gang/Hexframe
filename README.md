# Hexframe

Hexframe is a browser-based deterministic fighting-game Training lab. The public product has two routes: `/` is the project overview and `/play/` is the playable Training surface. Combat, frame inspection, replay tooling, the tutorial, and preferences run in the browser; the Worker is a small hardened routing boundary.

Controlled changes use the `HF-###` namespace and the title/body format in [Change management](docs/CHANGE-MANAGEMENT.md). Required PR checks are `verify`, `change-id`, and `secrets` on the exact head. The committed [GitHub settings](config/github-repository-settings.json) require current-with-main status, squash-only merges, automatic completed-branch deletion, zero bypass actors, and immutable `v*` tags. [AGENTS.md](AGENTS.md) carries the repository work protocol, and the [implementation plan](implementation_plan.md) is the current/future queue.

**[Overview](https://hexframe.wizardgang.ai)** · **[Training](https://hexframe.wizardgang.ai/play/)** · **[Case study](https://wizardgang.ai/projects/hexframe/)**

## Training MVP

Training opens directly at `/play/` with one fixed four-button kit:

| Input | Move | Role |
| --- | --- | --- |
| ↑ / Y | Jab | Mid |
| ← / X | Sweep | Low |
| → / B | Overhead | Overhead |
| ↓ / A | Uppercut | Launcher |

On hit, Jab can route into Sweep and then Uppercut.

The public Debug toggle is always available on screen and with the backtick key. It reveals frame transport, combat geometry, authoritative frame inspection, contact history, save states, and deterministic scenario capture/replay without adding a server-side player record.

The five-lesson tutorial runs inside Training. `?tutorial=1` starts it directly. Preferences, tutorial progress, and Debug visibility are device-local.

## Public routing

The two product routes are:

- `/` — public project overview.
- `/play/` — public Training.

`/play` permanently redirects to the canonical Training path and preserves `?tutorial=1`. Requests under `/api/*` receive the same generic JSON 404 because the MVP exposes no application API. Other missing paths use the hardened static 404 boundary.

## Run locally

Use the exact Node and npm versions committed by the repository.

```bash
npm ci
npm run dev
```

Local development needs no application credentials. Vite serves both `/` and `/play/` directly with hot reload.

## Command map

`npm run check` is the canonical credential-free acceptance gate. Network/provider checks stay separate.

| Purpose | Command | Boundary |
| --- | --- | --- |
| Install exact dependencies | `npm ci` | Local dependency install from the committed lockfile |
| Start local Training | `npm run dev` | Credential-free Vite dev server with hot reload for `/` and `/play/` |
| Repository acceptance | `npm run check` | Credential-free history, secrets, types, tests, build, document, security, and release-boundary validation |
| Documentation authority | `npm run validate:documentation-authority` | Verifies the current docs set, README references/commands, and retired vocabulary sweep |
| Dependency advisory gate | `npm run audit:dependencies` | Read-only npm registry query; fails closed on high/critical findings or an untrustworthy response |
| Live GitHub settings check | `npm run verify:github-settings` | Read-only provider comparison; requires an administration-readable token |
| Production config dry run | `npm run deploy:dry-run` | Non-publishing Wrangler production configuration validation |

Privileged repository-setting mutation and production deployment are not ordinary development commands. See the governed documents below before using those paths.

## Architecture and data

- `src/combat/` is the deterministic combat authority.
- `src/input/` resolves keyboard/gamepad input into the fixed kit.
- `src/rollback/` owns snapshots and deterministic replay.
- `src/lab/` owns Training, dummy behavior, tutorial, Debug tools, preferences, and frame tooling.
- `src/client/` owns browser entry points and presentation.
- `src/worker/` serves hardened static content, canonicalizes the Training path, and returns the generic API 404 boundary.

Combat state is not trusted or stored by the Worker. The current product keeps preferences, tutorial progress, and Debug visibility on the device.

See [Architecture](docs/ARCHITECTURE.md) and [Security model](docs/SECURITY-MODEL.md) for the detailed boundaries.

## Licensing

Hexframe is MIT-licensed. The distributable client contains first-party Hexframe code plus the runtime libraries declared in `package.json`.

- Runtime dependencies: `react` and `react-dom`; both are MIT-licensed.
- Development tooling: Vite, Vitest, TypeScript, Wrangler, and type packages.
- Fonts: family names only; no font file is bundled.
- Audio: synthesized at runtime with WebAudio; no audio asset is bundled.
- Art: the machine-generated fighter body parts under `characters/fighter/parts/` are bundled presentation assets adapted from the owner-directed FightLab source.
- External media: no third-party image, font, audio, or video asset is bundled.

Dependency and asset licensing must be re-reviewed whenever runtime dependencies or bundled media change.

## Documentation

The long-lived repository documents are intentionally small:

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Change management](docs/CHANGE-MANAGEMENT.md)
- [Release management](docs/RELEASE-MANAGEMENT.md)

## Release and deployment

Normal controlled changes do not publish production. Releases use immutable annotated semantic-version tags, GitHub Releases as the human-readable release authority, and the protected tag-driven deployment workflow described in [Release management](docs/RELEASE-MANAGEMENT.md).

The running release publishes its identity at [version.json](https://hexframe.wizardgang.ai/version.json).
