# Implementation plan

## Owner direction — show off the rig, keep it simple

The owner wants Hexframe to stop being an engineering showcase and become a small, good-looking, fun proof of concept: two rigged fighters, four readable attacks, clean effects and a two-minute tutorial. FightLab's newest rig replaces Hexframe's hand-drawn model, using only its machine-generated bodies. FightLab was retired on 2026-10-02. Anything that does not serve that goal is removed, along with dead code, low-value tests and tooling that works against keeping it simple.

This wave starts at HF-169. Work only the first open task. Each task is sized for about ten minutes of focused implementation; CI, review and merge time are extra.

### What the deep dive found

Measured on production v0.8.1 and `main` 77f07ea on 2026-10-02.

- **A visible defect in production.** Bone-name labels render around both fighters with Debug off (30 SVG text nodes on `/play/`). The only CSS rule that hides `.bone-name` is scoped to the overview, and nothing styles `show-skeleton`, so the Skeleton checkbox does nothing.
- **Engineering surfaces dominate the screen.** Training opens under a header, a tutorial banner and a toolbar. Debug adds frame transport (±1, ±10), pause-on-contact, five geometry checkboxes, a state inspector with hashes, a move frame timeline, contact history, scenario capture/replay/export/import and three save-state slots. The dummy has ten modes, including P2 record and playback on IJKL. Speed has four steps. Settings has 22 options. The fighters spawn 36 px apart and overlap.
- **The moveset carries systems the MVP does not need.** These are burn and freeze statuses with stack and duration rules, stamina with guard stamina, guard break and perfect guard, double-tap dash, numpad motion parsing for commands that use no motions, and two hidden fixture moves (`standing_light`, `crouching_light`).
- **Dead and test-only code.** `src/lab/debugger/panel.ts` has no importer. `src/rollback/replay/rollback-session.ts` (321 lines) is reached only by its own test. The seeded RNG is stored and snapshotted but never drawn from. `scripts/sync-secrets.mjs` is a throw-only stub kept alive by a release-boundary assertion.
- **Heavy content and presentation code.** About 1,300 lines load one fighter with six moves: `validate.ts` (816), the loader (273), raw types (232), four JSON schemas and Ajv. The look comes from a hand-drawn 15-part model, five JSON clips and about 380 lines of generated clips and pose rules. Effects are 301 lines of per-move particle "visual verbs", plus ray bursts and damage numbers.
- **Low-value tests and tooling.** Two Worker suites (166 lines) scan source to prove that retired modules stay deleted. A client test pins a CSS contrast value. The documentation validator carries a growing forbidden-vocabulary list. `npm run dev` runs through about 850 lines of process-ownership wrapper code and a Linux-only CI smoke, although local development no longer needs credentials.
- **FightLab left a cleaner rig.** It is an 11-bone contract with depth profiles, which decide which arm crosses the torso in a punch versus a walk. It has one sampler, about 45 lines of forward kinematics (FK), 11 compact machine-generated part SVGs (125–241 bytes each, coloured by CSS classes) and seven 13-pose authored clips. Its standing height of 104 rig units matches Hexframe's 104 px standing hurtbox.

### Product outcome

By the end of this queue a visitor can:

1. open `/play/` and immediately see two rigged fighters breathing in idle on a clean, full-screen stage;
2. walk, crouch, jump, block, and throw four attacks, each with its own readable animation;
3. land Jab → Sweep → Uppercut and launch the dummy;
4. see a crisp spark on every hit or block, short limb trails, hitstop, landing dust and a little shake;
5. turn on Skeleton to watch the 11-bone rig drive the body, Hitboxes to see the boxes, and Slow-mo to study the motion;
6. finish a four-lesson tutorial in about two minutes;
7. watch the fighter perform the kit as a looping showreel on `/`.

### Rules for this wave

- **Delete; don't deprecate.** Each task removes the code, styles, copy, docs and tests its own change makes unused, unless the next task is named for that deletion. A test is deleted only together with the behavior it proved, or replaced by a smaller proof of the behavior that remains.
- **The simulation stays the combat authority.** It stays fixed-step and integer. Rig, clips, trails and effects are presentation only and never feed back into combat.
- **FightLab is a read-only source.** Read its last pre-tombstone tree (`9d22b4be382c3eb6ddbd147970c9e5316c9bf5f2`) and adapt the code here; no task touches the FightLab repository. Port only the bodies, rig contract, FK, sampler, depth order and clips. Do not port wardrobe, cosmetics, atlas, tracer, footprint or mockup tooling.
- **No new runtime dependencies.** These stay: React for the build-time documents (WG-ARCH-001), the Worker, the desktop-only gate, gamepad support and the trusted-markup boundary in `src/client/trusted-markup.ts`.
- **Governance tooling is out of scope.** That covers the history, secret, patch-integrity, settings, release-identity and deploy guards, and the required `verify`, `change-id` and `secrets` checks.
- **No release before HF-197.**
- **Validation for every task.** Run the focused tests named in the task, then pinned `npm ci`, `npm run check`, `npm run audit:dependencies` and `git diff --check` on the exact head. A task that changes the screen also records a desktop browser check of `/play/`, and of `/` when the overview changes.

### Owner decisions recorded with defaults

Tasks follow these defaults unless the owner changes them before the task starts:

1. **Kit:** Jab (↑ / Y, mid), Sweep (← / X, low), Overhead (→ / B, overhead), Uppercut (↓ / A, launcher). On hit, Jab → Sweep → Uppercut.
2. **Systems removed:** statuses, stamina, guard break, perfect guard, dash, motion inputs, P2 recording, rewind, save states, scenarios, the inspection panels and the RNG.
3. **View toggles replace Debug:** Skeleton, Hitboxes and Slow-mo (25%). Pause (Space) and single-frame step (`.`) remain.
4. **Dummy modes:** Stand, Block and Fight back.
5. **Bodies:** FightLab's 11-bone rig with its 11 machine-generated parts and seven lab clips, in two colourways (player and dummy). New clips are authored in the same 13-pose format. The README records the FightLab and Boneyard provenance, and the adapted assets ship under Hexframe's MIT licence by owner direction.
6. **Tutorial:** four lessons (Move, Attack, Block, Combo), at most nine steps.
7. **Settings:** Volume, Reduced motion, High contrast, Text size and Vibration.
8. **Local development:** `npm run dev` is the Vite dev server.
9. **Release:** one release, v0.9.0, at the end of the wave. The owner approves the protected `production` deployment.

### Targets

| Measure | Today | Target | Tasks |
| --- | --- | --- | --- |
| `src/` | 60 files, 9,476 lines | under 6,000 lines | whole wave |
| Combat systems | statuses, stamina, guard break, perfect guard, dash, motion inputs, RNG | walk, crouch, jump, block, four attacks, cancels, launch | HF-173–HF-178 |
| Inspection controls | Debug panel with transport, geometry, inspector, timeline, contacts, scenarios, save slots, speed | Pause, step, Skeleton, Hitboxes, Slow-mo | HF-172–HF-174, HF-181 |
| Dummy modes | 10 | 3 | HF-178 |
| Settings | 22 | 5 | HF-179, HF-192 |
| Tutorial | 5 lessons, 17 steps | 4 lessons, at most 9 steps | HF-174, HF-194 |
| Fighter art | hand-drawn 15-part model; 5 JSON clips plus generated clips | FightLab 11-bone rig, 11 machine-generated parts, 13 authored clips | HF-180–HF-184 |
| Content pipeline | JSON, 4 schemas, 816-line validator, Ajv | one typed file | HF-186 |
| Local development | about 850-line wrapper plus a Linux CI smoke | `vite` | HF-171 |

## Open tasks

### HF-181 — [FEAT] Render fighters with machine-generated FightLab bodies

**Goal:** Both fighters and the overview preview are FightLab's 11-bone figure.

**Scope**
- Add the 11 machine-generated part SVGs and a `FigureView` adapted from FightLab's `render/figure.ts`. It places one flat group per bone by FK, repaints them in depth order, and inserts part markup only through the trusted-markup boundary.
- Add player and dummy colourways in CSS, and scale the figure to the 104 px standing hurtbox.
- Map states to clips: idle `labIdle`, walk `labWalk`, block `labGuard`, hitstun `labStagger`, Jab `labStrike` and Overhead `labOverhead`. Until HF-183 and HF-184 land, crouch, jump, Sweep and Uppercut borrow the closest existing clip.
- Add the Skeleton view toggle, which draws FK bones and joints over the body.

**Acceptance:** Fighters render, animate and mirror correctly at both facings, with arms crossing per depth profile; Skeleton lines up with the body.

**Validation:** `npm test -- tests/rig tests/renderer`; browser check of `/play/` and `/`.

---

### HF-182 — [REFACTOR] Delete the old rig, model and animation pipeline

**Goal:** There is one rig.

**Scope**
- Delete `characters/test_fighter/model.svg`, `rig.json` and `animations/`.
- Delete `src/renderer/character/rig.ts`, `src/renderer/animation/animator.ts`, and `src/content/additional-animations.ts`, `state-animations.ts`, `player-presentation.ts` and `test-fighter-assets.ts`.
- Delete their raw types and schemas, and the tests that only described the old model.

**Acceptance:** Nothing references the old model, rig or clip names.

**Validation:** `npm run check`.

---

### HF-183 — [FEAT] Author crouch, crouch-guard and jump clips

**Goal:** Crouching, low blocking and jumping get real poses.

**Scope:** Author `crouch`, `crouchGuard` and `jump` (rise, apex and fall) in the 13-pose clip format with depth profiles, and map them to their states.

**Acceptance:** Clip tests validate bone names, pose count and loop closure; crouch-guard reads as a low guard at both facings.

**Validation:** `npm test -- tests/rig`; browser check.

---

### HF-184 — [FEAT] Author sweep, uppercut and launched clips

**Goal:** Every kit move has its own animation.

**Scope:** Author `sweep` (a low leg sweep), `uppercut` (a rising strike) and `launched` (an airborne hit reaction and fall). Map Sweep, Uppercut and airborne hitstun to them.

**Acceptance:** Each clip validates; the three-hit combo reads clearly in Slow-mo.

**Validation:** `npm test -- tests/rig`; browser check in Slow-mo.

---

### HF-185 — [FEAT] Fit the kit's frame data and reach to its clips

**Goal:** Hits land where the limbs visibly are.

**Scope**
- Retime each move's startup, active and recovery frames to its clip's contact poses. Place each hitbox at the striking limb's FK tip during its active frames.
- Spawn the fighters about 80 px apart so they no longer overlap at reset.
- Keep the Jab → Sweep → Uppercut route, and update the move list and tests.

**Acceptance:** A test samples each move's clip at its first active frame and finds the striking limb tip inside the hitbox; the combo lands from reset distance after one step forward.

**Validation:** `npm test -- tests/simulation tests/rig`; browser check with Hitboxes and Skeleton on.

---

### HF-186 — [REFACTOR] Replace the JSON content pipeline with typed fighter data

**Goal:** One small typed file defines the fighter and its four moves.

**Scope**
- Author the fighter's stats, boxes and kit in TypeScript, with a pixel-to-simulation-unit helper.
- Delete `characters/test_fighter/character.json` and `moves/`, the `standing_light` and `crouching_light` fixtures, `schemas/`, `src/content/validate.ts`, `raw-types.ts`, the loader code only they used, Ajv and `validate:content`.
- Move the engine tests onto kit moves.

**Acceptance:** No JSON schema, validator or Ajv remains; engine tests pass on the kit.

**Validation:** `npm run check`.

---

### HF-187 — [FEAT] Draw limb motion trails from the rig

**Goal:** Strikes leave a short arc that shows the rig in motion.

**Scope:** During a move's active frames, record the striking limb's FK tip each frame and draw a tapered trail that fades over about six frames. Turn trails off under reduced motion.

**Acceptance:** Trails follow the limb at both facings and are gone by recovery; a pure test covers trail sampling.

**Validation:** `npm test -- tests/renderer`; browser check in Slow-mo.

---

### HF-188 — [FEAT] Add landing dust and impact shake

**Goal:** Landings and heavy hits carry weight.

**Scope:** Show a small dust puff when a fighter lands, and a brief stage shake on Overhead and Uppercut hits. Turn both off under reduced motion.

**Acceptance:** Each effect fires once per event; reduced motion disables both.

**Validation:** `npm test -- tests/renderer`; browser check.

---

### HF-189 — [FEAT] Make Training a full-bleed stage with compact controls

**Goal:** The game fills the screen.

**Scope**
- Remove the page header, hero copy and tutorial banner; the stage fills the viewport at desktop widths.
- Add one compact control strip (Pause, Reset, Dummy, Slow-mo, Hitboxes, Skeleton, Menu) and a one-line control hint.
- The pause menu holds Resume, Restart, Tutorial, Moves, Settings, Controls and Exit.

**Acceptance:** At 1440×900 and 1280×720 the stage fills most of the viewport without scrolling; keyboard and gamepad reach every control.

**Validation:** `npm test -- tests/lab`; browser check at both sizes.

---

### HF-190 — [FEAT] Restyle the stage floor, shadows and framing

**Goal:** A clean, good-looking arena.

**Scope**
- Replace the grid backdrop with a quiet gradient and floor line, and add soft contact shadows under each fighter.
- Frame the camera on both fighters with a sensible zoom.
- Fold the one-entry stage catalog in `src/game/session.ts` into the stage setup.

**Acceptance:** Fighters stay framed while walking apart and jumping, and shadows track their feet.

**Validation:** `npm test`; browser check.

---

### HF-191 — [FEAT] Restyle the health HUD

**Goal:** Health reads at a glance.

**Scope:** Show two slim health bars labelled You and Dummy, with a short damage-chip trail. Delete leftover HUD markup and styles.

**Acceptance:** Damage shows as an immediate drop plus a chip that drains, and the HUD stays clear of the fighters.

**Validation:** `npm test -- tests/lab`; browser check.

---

### HF-192 — [REFACTOR] Cut Settings to five options

**Goal:** Settings fit on one short page.

**Scope**
- Keep Volume, Reduced motion, High contrast, Text size and Vibration.
- Delete the rest, with their preference fields, styles and tests: interface volume, audio captions, mute when unfocused, camera shake, HUD opacity, theme, colour vision, dyslexia-friendly type, the strong-focus toggle (strong focus stays on), the screen-reader combat log, input glyphs and stick deadzone.
- Ignore stale stored preferences safely.

**Acceptance:** Settings shows exactly five options, and each has a visible effect.

**Validation:** `npm test -- tests/lab`; browser check.

---

### HF-193 — [FEAT] Turn the overview into a rigging showreel

**Goal:** The home page shows the rig moving.

**Scope**
- The overview hero renders the fighter performing idle and the four attacks on a loop through `FigureView` and the sampler, with a Skeleton toggle.
- Tighten the copy to the proof-of-concept story with one Play button, and remove claims about frame tools, replay and determinism.

**Acceptance:** The build-time document is still useful without JavaScript; the showreel loops smoothly and holds still under reduced motion.

**Validation:** `npm run validate:documents`; `npm test -- tests/client`; browser check of `/`.

---

### HF-194 — [FEAT] Rebuild the tutorial as four short lessons

**Goal:** A two-minute tutorial that feels like a game.

**Scope**
- The lessons are Move (walk, jump), Attack (all four buttons), Block (block the dummy's Jab, then its low Sweep) and Combo (Jab → Sweep → Uppercut), with at most nine steps.
- Delete the lesson, UI-event, telegraph and storage code the new lessons do not use.
- Replace `tests/lab/tutorial.test.ts` with a short headless run of every lesson.

**Acceptance:** The headless test completes all four lessons from scripted inputs, and no step passes on elapsed time alone.

**Validation:** `npm test -- tests/lab`; a keyboard-only browser run-through.

---

### HF-195 — [FEAT] Polish tutorial feedback and completion

**Goal:** Every step feels rewarded.

**Scope**
- Show the current step as one line near the stage, and flash a check with a confirm cue on success.
- End with the fighter's `labWave` celebration and a card offering Free play or Restart.
- Keep the first-visit prompt dismissible and non-blocking.

**Acceptance:** Each completed step gives visual and audio confirmation, and the completion card appears once.

**Validation:** `npm test -- tests/lab`; browser run-through.

---

### HF-196 — [DOCS] Consolidate documentation for the rigging MVP

**Goal:** The docs describe the small product that exists.

**Scope**
- Rewrite the README, `docs/ARCHITECTURE.md` and `docs/SECURITY-MODEL.md` around the kit, the FightLab rig and its machine-generated bodies, the view toggles and the Vite dev loop.
- Record the FightLab and Boneyard provenance for the rig, parts and clips.
- Sweep the remaining styles, copy and tests for removed features.

**Acceptance:** Every README link and command resolves, and no document describes a removed system.

**Validation:** `npm run validate:documentation-authority`; `npm run check`.

---

### HF-197 — [BUILD] Release v0.9.0

**Goal:** Ship the rigging MVP.

**Scope**
- Set `package.json` and `package-lock.json` to 0.9.0, and return `implementation_plan.md` to the permanent empty template.
- After merge, the Release Cutter tags v0.9.0 and the Release workflow publishes it; the owner approves the protected `production` deployment.

**Acceptance:** Production `/version.json` reports v0.9.0, and `/` and `/play/` show the new rig, effects and tutorial. If approval is pending, stop there and report.

**Validation:** Standard validation; the Release and Deploy runs; a production browser check.
