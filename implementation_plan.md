# Implementation plan

## MVP training reset

Owner direction, 2026-09-27: return Hexframe to a gameplay-first training MVP. Training is the only mode. A fixed four-button kit replaces the sixteen-slot action banks and loadouts. The debug tools become public behind one on-screen toggle. The standalone Codex is retired in favor of an in-game move list. Server-side saves are deleted. v0.8.0 is released once the rest of this queue lands.

Wave rules:

- The kit: ↑ / Y Ember Palm (mid), ← / X Ashen Sweep (low), → / B Frost Heel (overhead), ↓ / A Phoenix Drive (launcher). On hit, Ember Palm → Ashen Sweep → Phoenix Drive.
- Each task deletes the tests, styles, copy and documentation its own change makes obsolete, and deletes a module in the task that removes its last consumer.
- Each merge leaves `main` building and Training playable. The required `verify`, `change-id` and `secrets` checks, `npm run check` as the canonical credential-free gate, squash-only protected `main` and immutable `v*` tags stay in place.
- No tag, GitHub Release, production deployment, provider secret or DNS change happens before HF-161.
- Standard validation: pinned `npm ci`, focused tests, `npm run check`, `npm run audit:dependencies`, `git diff --check` over the committed range, exact-head required CI, post-merge CI and automatic branch deletion. Tasks that change the game screen also record a desktop browser check of `/play/`.

## Open tasks

### HF-154 — [DB] Delete server-side saves, loadout presets and armor

- Dependency: HF-153 delivered.
- Why: After HF-153 the player save only supplies Training's active preset and armor, and the Worker bundles combat content solely to validate crafting and rewards that no screen can reach.
- Scope: Delete the `PlayerSaveObject` Durable Object and its `PLAYER_SAVES` bindings, `/api/save` and its operations, the signed `hf_player` identity cookie, `src/player/`, `src/lab/build-state.ts`, the armor, material, crafting and set-perk content, and the save store's Black Belfry validation. Add the Wrangler migration that deletes the `PlayerSaveObject` class. Training builds the Test Fighter from the default loadout with no equipment; preferences and tutorial progress stay in device storage. Update the security model and architecture documents for the removed save authority.
- Non-goals: Do not change engine perk, armor-mitigation or resistance code (HF-155), the input scheme (HF-156) or authentication (HF-159).
- Acceptance: The Worker bundle imports no combat content or save module; `/api/save` paths return the generic JSON 404; `npm run deploy:dry-run` accepts the configuration with the deletion migration; no source or test references the save, presets, armor or crafting.
- Risk: High. Cloudflare deletes every stored player save when the next release deploys, and redeploying v0.7.9 afterwards does not restore them.
- Validation: Standard validation plus `npm run deploy:dry-run` and a browser check of Training.
- Authorities: `wrangler.jsonc`, `src/worker/index.ts`, `src/worker/env.ts`, `docs/SECURITY-MODEL.md`, `docs/ARCHITECTURE.md`.

### HF-155 — [REFACTOR] Prune campaign-only engine features

- Dependency: HF-153 and HF-154 delivered.
- Why: The simulation, snapshots and renderer still carry Black Belfry entities, boss-arena state, multi-fighter teams and equipment perks that Training never exercises.
- Scope: Remove stage entities (breakables, pickups, interactables, hazards), checkpoints, boss arena, gate and reward state and entity events; the Interact input bit and its E / RB bindings; boss telegraph and Black Belfry backdrop rendering; teams, friendly fire and support for more than two fighters; and equipment perks, flat armor mitigation and elemental resistances. Delete `black-belfry.ts` with its last consumers. Bump `SNAPSHOT_VERSION` for the smaller state.
- Non-goals: Keep movement, dash, jump, guard, perfect guard, guard break, stamina, hitstop, pushback, invulnerability and hyper-armor move windows, statuses, snapshots, rollback and hashing. Do not change the move catalog or inputs (HF-156).
- Acceptance: A match is exactly two fighters on the Training Grid; determinism, snapshot round-trip and rollback tests pass on the reduced state; no source or test references stage entities, checkpoints, bosses, teams, perks or Interact.
- Validation: Standard validation plus the simulation, snapshot and rollback suites.
- Authorities: `src/combat/types.ts`, `src/combat/simulation/simulation.ts`, `src/rollback/snapshots/snapshot.ts`, `src/renderer/svg/`, `docs/ARCHITECTURE.md`.

### HF-156 — [FEAT] Replace the sixteen-slot action banks with a four-button kit

- Dependency: HF-155 delivered.
- Why: Sixteen modifier-banked slots over a 29-move catalog are the main source of control and UI complexity; the MVP needs one readable set of attacks.
- Scope: Reduce the action slots to four: the arrow keys and Y / X / B / A each fire one fixed kit move, with no Shift, Ctrl/⌘ or trigger banks and no loadout. Stop capturing modified arrow keys. Delete the other catalog moves with their animations and particle profiles, keeping `standing_light` and `crouching_light` only as schema-validated engine fixtures. Author the kit's on-hit cancels so Ember Palm → Ashen Sweep → Phoenix Drive works. Remove the poison, shock and bleed statuses; burn and freeze remain. Point the dummy's counterattack and reversal modes at the kit. Delete the action-bank, loadout, route-grammar and move-filter helpers and `docs/TEST_FIGHTER.md`. Adapt the existing tutorial and control legend to the four buttons, dropping the modifier lesson, so both stay usable until HF-157 and HF-158.
- Non-goals: Do not redesign the training screen (HF-157) or the tutorial lessons (HF-158).
- Acceptance: Each kit move starts from keyboard and gamepad without modifiers; a headless test lands the three-hit route; no source or test references action banks, loadouts, removed moves or removed statuses.
- Validation: Standard validation plus the input, command, content, move-effect and animation suites and a browser check with keyboard and gamepad.
- Authorities: `src/combat/types.ts`, `src/content/test-fighter.ts`, `src/content/additional-moves.ts`, `src/input/`, `src/lab/dummy/dummy.ts`, `schemas/`.

### HF-157 — [FEAT] Rebuild Training around an on-screen Debug toggle

- Dependency: HF-156 delivered.
- Why: Public Training hides hitboxes, frame stepping and the inspectors inside a pause menu that stops the game, while the useful inline layout is reachable only after signing in.
- Scope: Make `/play/` start the Training session directly, with no launch page and no query parameters; build the page at `play/index.html` and delete the Worker's `/lab/`-to-`/play/` HTML and asset rewriting. Keep a compact always-visible bar for play/pause, reset, dummy mode and speed. Add one Debug toggle, an on-screen button plus the `` ` `` key, remembered on the device and available to every visitor, that shows or hides without pausing: hitbox, hurtbox, pushbox, origin and skeleton overlays; the frame counter, step ±1 and ±10 and pause-on-contact; the frame inspector, move frame timeline and contact history; save states; and scenario capture, replay, export and import. Fold the separate developer layout into this one screen. Reduce the pause menu to Resume, Restart, Tutorial, Move list, Settings, Controls and Exit; the move list shows each kit move's input, level, damage and startup, active and recovery frames. Collapse Settings to one page and drop options that have no effect or whose feature is gone (mono audio, music, ambience, dynamic range, visual quality, menu wrap, crafting confirmation). Update the overview's training links and copy.
- Non-goals: Do not change combat rules or the kit. Do not remove the sign-in stack or the Codex (HF-159).
- Acceptance: At desktop width, Debug toggles every inspection surface while the match keeps running; keyboard and gamepad reach every control; the accessibility contract test covers the new layout; `/play/` needs no query string; the move list matches the kit's authored frame data.
- Validation: Standard validation plus a desktop browser run-through with Debug on and off.
- Authorities: `src/lab/app.ts`, `src/lab/view.ts`, `src/client/styles/lab.css`, `src/documents/site-documents.tsx`, `vite.config.ts`, `src/worker/routes/play.ts`.

### HF-158 — [FIX] Rebuild the tutorial so every lesson can be completed

- Dependency: HF-157 delivered.
- Why: Two lessons require screens Training does not have, the tutorial cannot be started or restarted in the game, and its panel covers the health bars.
- Scope: Replace the lessons with Movement, Defense (the dummy attacks mid, low and overhead), Attacks (the four kit buttons), Combo (Ember Palm → Ashen Sweep → Phoenix Drive) and Inspect (turn on Debug, pause on contact, step one frame). Start and restart the tutorial from the pause menu, offer a dismissible first-visit prompt that does not block play, keep progress in device storage, and place the panel clear of the health bars. Delete lesson, UI-event and storage code the new lessons do not use.
- Non-goals: Do not add lessons for features outside the MVP.
- Acceptance: A headless test completes every lesson from scripted inputs and UI events, and no lesson passes on elapsed time alone; a keyboard-only browser run completes the tutorial end to end; the tutorial can be restarted from the pause menu.
- Validation: Standard validation plus the tutorial suite and a browser run-through.
- Authorities: `src/lab/tutorial.ts`, `src/lab/app.ts`, `src/lab/view.ts`.

### HF-159 — [SEC] Retire the private developer surface

- Dependency: HF-157 delivered; the debug tools are public in Training and the move list is in the game.
- Why: With Debug public and the Codex replaced, the sign-in stack guards only a username echo and a desync log.
- Scope: Delete `/login`, `/logout`, `/lab`, `/codex`, `/api/lab/*`, the Training debug-flag gate, the session and credential modules, the `ADMIN_*` bindings, the standalone Codex bundle, document and styles, and the move-demonstration code. Reduce the Vite inputs to the overview and Training. Make `npm run dev` start without `.env` or `.dev.vars` while keeping its process-ownership and cleanup guarantees, and update the CI dev smoke, `.env.example`, the `sync-secrets.mjs` stub and its release-boundary assertion. Update README, `SECURITY.md`, the security model and architecture for a public static game behind hardened headers.
- Non-goals: Do not change provider secrets, remove the tracked-secret scans, or weaken release and deployment controls.
- Acceptance: The Worker serves only hardened static assets, the `/play` slash redirect and a JSON 404 for `/api/*`; route tests cover each remaining route and a 404 for each retired one; `npm run dev` and the CI dev smoke pass with no credentials file; secret scanning and release-boundary validation still pass.
- Risk: High. Removes authentication. The production `ADMIN_*` secrets become unused but are not deleted here.
- Validation: Standard validation plus the CI dev smoke and a local `npm run dev` start and stop.
- Authorities: `src/worker/`, `scripts/dev.mjs`, `scripts/dev-smoke.mjs`, `scripts/validate-release-boundary.mjs`, `vite.config.ts`, `SECURITY.md`, `docs/SECURITY-MODEL.md`.

### HF-160 — [DOCS] Consolidate documentation for the MVP

- Dependency: HF-159 delivered.
- Why: After the reset, the documentation should describe one small product without leftover history or duplication.
- Scope: Fold `docs/LICENSING.md` into the README and update the documentation validator. Rewrite README, `docs/ARCHITECTURE.md` and `docs/SECURITY-MODEL.md` around the two public routes, the four-button kit, the Debug toggle and the reduced Worker. Trim the README command map to commands that still exist. Remove stale comments in `wrangler.jsonc` and the Worker sources, and sweep the remaining styles, copy and tests for removed features.
- Non-goals: Do not change `AGENTS.md`, `CONTRIBUTING.md`, the change-management or release-management rules, or the required checks.
- Acceptance: `docs/` holds only architecture, security model, change management and release management; every README link and command resolves; no tracked file mentions the campaign, Black Belfry, Bell Warden, armory, crafting, loadouts, the Codex or sign-in except where a validator guards their retirement.
- Validation: Standard validation plus `npm run validate:documentation-authority`.
- Authorities: `README.md`, `docs/`, `scripts/validate-documentation-authority.mjs`.

### HF-161 — [BUILD] Release v0.8.0

- Dependency: HF-153 through HF-160 delivered, with green post-merge CI on `main`.
- Why: Production still serves v0.7.9 with the broken tutorial; the MVP reset ships as one minor release.
- Scope: Set `package.json` and `package-lock.json` to 0.8.0, and retire this task and the wave notes by returning `implementation_plan.md` to the permanent empty template. After merge, create an annotated `v0.8.0` tag on that exact commit and push it so the Release workflow reproduces it, publishes the GitHub Release and calls the protected deploy.
- Non-goals: Do not deploy outside the tag-driven workflow, move or delete a tag, or change provider secrets.
- Acceptance: The Release workflow passes; the production environment reviewer approves the protected deployment; the deploy verifies the uploaded version is live at 100%; public `version.json` reports v0.8.0 at the tagged commit; `/`, `/play/` and a retired route behave as expected in production.
- Risk: High. The deploy mutates production and applies the save-store deletion. Treat rollback as a forward corrective release, because v0.7.9 predates the deletion migration and cannot restore deleted saves.
- Validation: Standard validation, `npm run verify:release-identity -- --tag v0.8.0` after tagging, the Release and Deploy workflow runs, and a production browser check.
- Authorities: `docs/RELEASE-MANAGEMENT.md`, `.github/workflows/release.yml`, `.github/workflows/deploy.yml`, `scripts/deploy.mjs`.
