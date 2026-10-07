# Architecture

Hexframe is a small browser fighting-game rigging MVP built around one rule: **the simulation is the combat authority**. Inputs advance fixed-step integer combat state. The rig, clips, forward kinematics, depth order, hitboxes, trails, effects, tutorial feedback, and showreel consume that state without deciding combat outcomes.

## Public product

There are two public product routes:

| Route | Purpose |
| --- | --- |
| `/` | Build-time overview plus the looping rigging showreel |
| `/play/` | Training document plus the interactive browser runtime |

`/play` permanently redirects to `/play/` and preserves `?tutorial=1`. The Worker returns a generic JSON 404 under `/api/*`; the current product exposes no application API.

Training uses one four-button kit:

| Input | Move | Role |
| --- | --- | --- |
| ↑ / Y | Jab | Mid |
| ← / X | Sweep | Low |
| → / B | Overhead | Overhead |
| ↓ / A | Uppercut | Launcher |

Jab can route on hit into Sweep and then Uppercut. Movement adds walk, crouch, jump, and block. The dummy has Stand, Block, and Fight back modes.

The study surface is intentionally small: Pause, Reset, Dummy, Slow-mo, Hitboxes, Skeleton, and Menu. Slow-mo changes presentation cadence to 25%; Hitboxes exposes combat geometry; Skeleton draws the presentation rig. None of those controls can author combat outcomes.

## Authority model

| Concern | Authority |
| --- | --- |
| Combat result for a frame | `src/combat/simulation/simulation.ts` |
| Fighter stats, boxes, four moves, and command mapping | `src/content/test-fighter.ts` |
| Keyboard/gamepad resolution | `src/input/` |
| Rig contract, clip sampling, FK, and depth order | `src/rig/` |
| State-to-clip presentation mapping | `src/renderer/character/fightlab-presentation.ts` |
| Fighter rendering and presentation effects | `src/renderer/` |
| Training controls, dummy, tutorial, preferences | `src/lab/` |
| Build-time documents and browser entry points | `src/documents/` and `src/client/` |
| Public routing and response hardening | `src/worker/` |

The Worker does not own combat, progression, player identity, or browser preferences.

## Simulation and presentation

Combat state advances at a fixed 60 Hz with integer simulation quantities. Authored pixel measurements cross into simulation units at the typed content boundary.

Presentation is downstream:

```text
typed fighter + input
        ↓
fixed-step combat simulation
        ↓
frame state + contact reports
        ↓
rig / renderer / effects
        ↓
Training UI + showreel
```

`fightLabPresentation` selects a presentation clip from the authoritative fighter state. Clip sampling, forward kinematics, depth profiles, body-part paint order, mirroring, Skeleton drawing, trails, hit sparks, dust, hitstop presentation, and screen shake never feed values back into combat.

The visible fighter uses an 11-bone rig and 13 clips. Seven `lab*` clips and the rig/parts were adapted through FightLab from the original Boneyard lane; six additional clips were authored in Hexframe in the same 13-pose format. The exact provenance hashes live in the README.

## Training and tutorial

`src/lab/app.ts` mounts the simulation, renderer, keyboard/gamepad input, dummy controller, preferences, audio, and tutorial around one full-screen stage.

The tutorial contains Move, Attack, Block, and Combo lessons with at most nine simulation-driven steps. A step completes only when the simulation reports the required state or contact; elapsed wall-clock time does not complete objectives. Success feedback and the final `labWave` are presentation only.

The pause menu contains seven actions: Resume, Restart, Tutorial, Moves, Settings, Controls, and Exit. Settings are Volume, Reduced motion, High contrast, Text size, and Vibration.

Device-local storage is limited to convenience state: preferences, the three study toggles, and tutorial-invite dismissal. Tutorial lesson progress itself lasts only for the current run.

## Documents and browser runtime

The overview and Training fallback are React 19 TSX documents rendered during the Vite build with `react-dom/server`. Their navigation, copy, and fallbacks exist before browser JavaScript runs.

Interactive combat and the showreel require browser JavaScript. React document rendering does not own simulation state, hit resolution, input handling, or persistence.

Repository-owned fighter-part SVG source crosses one audited markup boundary in `src/client/trusted-markup.ts`. That parser rejects script/style elements, inline event handlers, inline style attributes, and JavaScript URLs before the markup enters the rendered figure.

Local development is the direct Vite loop:

```bash
npm ci
npm run dev
```

No application credentials are needed for local development.

## Worker boundary

Every deployed request passes through `src/worker/index.ts` before static assets. The Worker owns only:

- `/` overview delivery;
- canonical `/play` → `/play/` redirect behavior;
- `/play/` and built assets;
- generic JSON 404 responses under `/api/*`;
- hardened text 404s for other missing paths;
- response security headers.

Production credentials exist only in protected deployment/provider state and are not part of the runtime application contract.
