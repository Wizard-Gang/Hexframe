# Hexframe

Hexframe is a small browser fighting-game rigging MVP: two rigged fighters, four readable attacks, clean hit feedback, study toggles, and a four-lesson tutorial. The public product has two routes: `/` is the rigging showreel and `/play/` is the playable Training surface. Combat stays deterministic and client-side; the rig, clips, trails, effects, and showreel are presentation only.

Controlled changes use the `HF-###` namespace and the title/body format in [Change management](docs/CHANGE-MANAGEMENT.md). Required PR checks are `verify`, `change-id`, and `secrets` on the exact head. The committed [GitHub settings](config/github-repository-settings.json) require current-with-main status, squash-only merges, automatic completed-branch deletion, zero bypass actors, and immutable `v*` tags. [AGENTS.md](AGENTS.md) carries the repository work protocol, and the [implementation plan](implementation_plan.md) is the current/future queue.

**[Overview](https://hexframe.wizardgang.ai)** · **[Training](https://hexframe.wizardgang.ai/play/)** · **[Case study](https://wizardgang.ai/projects/hexframe/)**

## Rigging MVP

Training opens directly at `/play/` with one fixed four-button kit:

| Input | Move | Role |
| --- | --- | --- |
| ↑ / Y | Jab | Mid |
| ← / X | Sweep | Low |
| → / B | Overhead | Overhead |
| ↓ / A | Uppercut | Launcher |

On hit, Jab can route into Sweep and then Uppercut. Movement is WASD or left stick; the fighter can walk, crouch, jump, and block.

The Training bar keeps the study surface small: Pause, Reset, Dummy, Slow-mo, Hitboxes, Skeleton, and Menu. Dummy behavior is limited to Stand, Block, and Fight back. Slow-mo runs at 25%; Hitboxes shows combat geometry; Skeleton exposes the 11-bone presentation rig without affecting combat state.

The tutorial has four short lessons: Move, Attack, Block, and Combo. It has at most nine simulation-driven steps, gives visual/audio confirmation for each success, and ends with the fighter's `labWave` celebration plus Free play and Restart actions.

The overview at `/` loops the rig through idle and the four attacks. With reduced motion enabled, it holds a ready pose instead of animating the showreel.

## Rig and motion provenance

Hexframe's presentation lane was adapted from the final read-only FightLab source at `SouthernGentlemen/FightLab` commit `9d22b4be382c3eb6ddbd147970c9e5316c9bf5f2`.

FightLab's own provenance records the retained rig/runtime core, eleven fighter parts, runner figure, and seven original `lab*` clips as ported from `SouthernGentlemen/Boneyard` baseline `ed5547fdd5eaed4876aba1d9790685d40d948218`. Its accepted BY-031 runner-fit delta `ebf545f3c7b3bbc58bc0c3a936de154e84553371` changed no art, geometry, or motion. Both source repositories are retired; these hashes are provenance only and are not runtime or build dependencies.

Hexframe vendors the 11-bone rig contract/runtime concepts, the eleven machine-generated fighter part SVGs under `characters/fighter/parts/`, and the seven original FightLab/Boneyard lab clips: `labGuard`, `labIdle`, `labOverhead`, `labStagger`, `labStrike`, `labWalk`, and `labWave`. Hexframe then authored `crouch`, `crouchGuard`, `jump`, `launched`, `sweep`, and `uppercut` in the same 13-pose clip format.

The adapted rig, parts, and clips ship as part of Hexframe's MIT-licensed repository by owner direction. Their source lineage remains recorded here so the current repository can stay self-contained without obscuring where the presentation work came from.

## Public routing

The two product routes are:

- `/` — public rigging showreel.
- `/play/` — public Training.

`/play` permanently redirects to the canonical Training path and preserves `?tutorial=1`. Requests under `/api/*` receive a generic JSON 404 because the MVP exposes no application API. Other missing paths use the hardened static 404 boundary.

## Run locally

Use Node 26.10.0 and npm 12.1.0, matching the repository pins.

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
| Start local app | `npm run dev` | Credential-free Vite dev server with hot reload for `/` and `/play/` |
| Repository acceptance | `npm run check` | Credential-free history, secrets, types, tests, build, document, security, and release-boundary validation |
| Documentation authority | `npm run validate:documentation-authority` | Verifies the current docs set, README references/commands, MVP vocabulary, and provenance |
| Dependency advisory gate | `npm run audit:dependencies` | Read-only npm registry query; fails closed on high/critical findings or an untrustworthy response |
| Live GitHub settings check | `npm run verify:github-settings` | Read-only provider comparison; requires an administration-readable token |
| Platform conformance | `npm run check:platform` | Verifies the vendored baseline pin and Hexframe Worker configuration |

Privileged repository-setting mutation and production deployment are not ordinary development commands. See the governed documents below before using those paths.

## Architecture and data

- `src/combat/` is the fixed-step integer combat authority.
- `src/content/test-fighter.ts` is the typed fighter/kit definition.
- `src/input/` resolves keyboard and gamepad input into movement, block, and the fixed kit.
- `src/rig/` owns the adapted clip sampler, forward kinematics, and depth ordering.
- `src/renderer/` consumes combat state and reports to draw the rig, hitboxes, trails, sparks, dust, and presentation-only shake.
- `src/lab/` owns Training, the three dummy modes, tutorial, study toggles, preferences, and pause menu.
- `src/client/` owns browser entry points and the build-time document/showreel presentation.
- `src/worker/` serves hardened static content, canonicalizes the Training path, and returns the generic API 404 boundary.

The Worker stores no combat or player state. Preferences, the three study toggles, and tutorial-invite dismissal are device-local convenience state; tutorial lesson progress exists only for the current run.

See [Architecture](docs/ARCHITECTURE.md) and [Security model](docs/SECURITY-MODEL.md) for the detailed boundaries.

## Licensing

Hexframe is MIT-licensed. The distributable client contains first-party Hexframe code plus the runtime libraries declared in `package.json`.

- Runtime dependencies: `react` and `react-dom`; both are MIT-licensed.
- Development tooling: Vite, Vitest, TypeScript, Wrangler, and type packages.
- Fonts: family names only; no font file is bundled.
- Audio: synthesized at runtime with WebAudio; no audio asset is bundled.
- Art and motion: the rig, eleven machine-generated fighter parts, seven imported lab clips, and six Hexframe-authored extension clips are bundled presentation assets under the owner-directed MIT repository treatment described above.
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
