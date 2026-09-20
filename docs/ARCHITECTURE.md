# Architecture

Hexframe is organised around one idea: **the simulation is the only authority.** One frame
of inputs goes in, one frame of authoritative state comes out, and everything else —
rendering, tooling, the server, the AI — is downstream of that.

## Authority model

| Concern | Authority | Everything else |
| --- | --- | --- |
| What happened in a frame | `src/combat/simulation/simulation.ts` | Reads `FrameReport`; cannot change the outcome |
| What a fighter looks like | Derived from authoritative state | The renderer draws it; it never decides it |
| Whether an attack hit | The browser simulation | The Worker has no opinion and never has |
| What a party member does | `LoadoutAIController`, from state and seed | Emits input frames like a controller does |
| What the player owns | The versioned player save | The device holds a cache, not the record |

The Worker is a router. It authenticates, routes and persists; it holds no combat logic.

## Module layers

A module may depend only on layers below it. This is enforced by the shape of the imports,
and it is why every commit in this repository builds on its own.

```
L0   combat/types · combat/constants · content/raw-types · worker/env
L1   combat/state/machine · combat/collision/aabb · content/validate
     input/buffer/{history,input-buffer} · input/parser/numpad
     rollback/snapshots/snapshot · worker/auth/session
L2   combat/commands/resolve · combat/movement/physics · content/loader
     input/parser/command-parser · rollback/hashing/fnv · rollback/snapshots/ring
L3   combat/collision/boxes · content/test-fighter · renderer/animation/animator
L4   combat/collision/pushbox · combat/hit-resolution/resolve · combat/entities/resolve
L5   combat/simulation/simulation · worker/index
L6   combat/index · rollback/replay/rollback-session
L7+  renderer/** · game/** · lab/** · client/**
```

`src/combat`, `src/rollback`, `src/input` and `src/game` import **nothing** from
`src/renderer`, `src/lab` or `src/client`. That is checked, not assumed.

## Determinism

Determinism is a property of the state representation, not a coding convention:

- Every stored quantity is a 32-bit integer. Positions are *sim units* at 1/100 pixel;
  content is authored in whole pixels and converted once, in the loader.
- The frame rate is fixed at 60 Hz and never derived from a browser `deltaTime`.
- Command parsing happens **inside** the step, so a rollback cannot depend on the caller
  re-running a parser the simulation cannot see.
- The only randomness is a seeded xorshift whose state lives in `SimState`, so restoring a
  snapshot restores the generator with it.

`src/combat`, `src/rollback`, `src/input`, `src/game`, `src/content` and `src/renderer`
contain no `Math.random`, `Date.now`, `performance.now` or `crypto.getRandomValues`.

## Data contracts

| Contract | Version tag | Why it matters |
| --- | --- | --- |
| Snapshot format | `SNAPSHOT_VERSION` | Readers reject other versions rather than misread them |
| Player save | document `version` | Normalization accepts an older document and returns a current one |
| Authored content | JSON Schema under `schemas/` | Validated by test before it can reach the simulation |

## Document and interactive-client boundary

Hexframe has two presentation modes with deliberately different responsibilities:

- The root overview, public Training entry document, and authenticated Move Codex document are HTML documents rendered from React 19 TSX during the Vite build. Their useful headings, navigation, explanatory copy, and fallback content exist in the built HTML before browser JavaScript runs.
- Combat, simulation, training controls, animation, developer inspection, and interactive Codex demonstrations are a browser client application. Those capabilities intentionally require JavaScript because they execute and inspect the deterministic game runtime rather than decorate an otherwise complete document.

React is the document-presentation authority, not the combat authority. The build-time document components do not own game state, hit resolution, input parsing, persistence, or routing. They are rendered with `react-dom/server` and are not hydrated merely to satisfy a React architecture.

The Worker remains the routing, authentication, and persistence boundary. Workers Static Assets serves the Vite output. Authoritative combat remains in the browser simulation exactly as described above; moving document rendering to React does not move simulation authority into React or the Worker.

This client-application boundary is Hexframe's explicit WG-ARCH-001 exception to the normal expectation that a product document remain fully operable without JavaScript: the documents remain useful without JavaScript, while the game itself necessarily requires the browser client.

## What is deliberately not here

- **No server authority over combat.** Networked play, when it arrives, relays inputs.
- **No floats below `src/combat`.** Two machines disagreeing in the last bit disagree about
  whether an attack hit.
- **No ambient randomness anywhere the simulation can see it.**
