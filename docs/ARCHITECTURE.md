# Architecture

Hexframe is a small browser Training product built around one rule: **the simulation is the combat authority**. One frame of inputs produces one frame of authoritative state. Rendering, Training tools, replay inspection, documents, and the Worker consume that state without deciding combat outcomes.

## Public product

There are two public product routes:

| Route | Purpose |
| --- | --- |
| `/` | Project overview rendered as a useful build-time document |
| `/play/` | Training document plus the interactive browser runtime |

`/play` is only a canonical redirect to `/play/` and preserves `?tutorial=1`. The Worker returns a generic JSON 404 under `/api/*`; the current product exposes no application API.

Training contains the fixed four-button kit:

| Input | Move |
| --- | --- |
| ↑ / Y | Jab |
| ← / X | Sweep |
| → / B | Overhead |
| ↓ / A | Uppercut |

Jab can route on hit into Sweep and then Uppercut. The dummy, five-lesson tutorial, frame transport, combat geometry, contact inspection, save states, and deterministic scenario replay all operate on the same browser simulation.

## Authority model

| Concern | Authority |
| --- | --- |
| Combat result for a frame | `src/combat/simulation/simulation.ts` |
| Input resolution | `src/input/` plus authored command data |
| Snapshot/replay state | `src/rollback/` |
| Training interaction and tools | `src/lab/` |
| Visual presentation | `src/renderer/` and `src/client/` |
| Preferences, tutorial progress, Debug visibility | Device-local browser storage |
| Public routing and response hardening | `src/worker/` |

The Worker does not own combat, progression, player identity, or browser preferences.

## Determinism

Determinism is encoded in the state model:

- Stored combat quantities are 32-bit integers; authored pixel values are converted to simulation units at the content boundary.
- The simulation advances at a fixed 60 Hz rather than browser wall-clock time.
- Command parsing happens inside the deterministic step.
- Randomness is seeded and its state is part of the simulation snapshot.
- Snapshot readers validate their version instead of guessing across incompatible formats.

The combat, rollback, input, game, content, and renderer layers do not use ambient time or randomness as combat authority.

## Layering

Lower-level simulation modules do not import the Training UI:

```text
combat / input / content
        ↓
game / rollback
        ↓
renderer
        ↓
lab / client
```

The Worker is a separate public edge boundary. It receives requests, canonicalizes the Training path, serves Workers Static Assets, returns the generic API 404 response, and applies hardened response headers.

## Documents and browser runtime

The overview and Training fallback are React 19 TSX documents rendered during the Vite build with `react-dom/server`. Their headings, navigation, explanatory copy, and fallback content exist before browser JavaScript runs.

Interactive combat necessarily requires the browser runtime. React document rendering does not own simulation state, hit resolution, input parsing, persistence, or routing.

Imperative Training views may cross one audited raw-markup boundary in `src/client/trusted-markup.ts`. That parser rejects script/style elements, inline event handlers, inline style attributes, and JavaScript URLs. Other application parser sinks are rejected by presentation-security validation.

## Worker boundary

Every deployed request passes through `src/worker/index.ts` before static assets. The reduced Worker owns only:

- `/` static overview delivery;
- canonical `/play` → `/play/` redirect behavior;
- `/play/` and its built assets;
- generic JSON 404 responses under `/api/*`;
- hardened text 404s for other missing paths;
- response security headers.

Local development uses the same routing shape without application credentials. Production credentials exist only in protected deployment/provider state and are not part of the runtime application contract.
