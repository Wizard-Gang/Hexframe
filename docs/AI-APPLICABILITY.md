# AI applicability

## Scope

**Hexframe contains no machine learning.** No model is trained, bundled, downloaded, or
called, at build time or at run time. The runtime dependencies are presentation libraries; none is a model, inference runtime, or machine-learning package.

The word "AI" in this repository refers to one thing: `LoadoutAIController`, a
deterministic rule system that plays a party slot. It is not a learned model and must not
be described as one.

## What the AI is

`src/game/loadout-ai-controller.ts` is constructed with `(profile, seed)` and, for each
frame, receives `(state, fighterIndex, characters, teams, lastReport)` and returns an
`InputFrame` — the same 16-bit value a keyboard or gamepad produces.

It holds no evolving decision state between frames. Given identical arguments it returns an
identical input.

## Decision authority

| Decision | Made by |
| --- | --- |
| Which technique a party member attempts | `LoadoutAIController`, from authored loadout data |
| Whether that technique hits | The simulation, exactly as for a human player |
| What techniques exist | Authored content under `characters/` and `src/content/` |
| What the player's own build is | The player |

The controller has **no privileged path into simulation state**. It cannot set health, force
an outcome, or read anything a human player's interface could not read. There is no
AI-only combat system: it selects among the same authored `MoveDef` data a human loadout
uses.

## Determinism and reproducibility

This is the property the whole design depends on: a rollback re-runs past frames, and if
AI decisions were not reproducible, the humans would resynchronise and the party members
would not.

Verifiable in this repository:

```bash
# No ambient nondeterminism in any authoritative path.
grep -rn 'Math\.random\|Date\.now\|performance\.now\|crypto\.getRandomValues' \
  src/combat src/rollback src/input src/game src/content src/renderer
# -> no matches

# No machine-learning dependency of any kind.
grep -rniE 'tensorflow|onnx|openai|anthropic|inference|neural' src/
# -> no matches

npm test   # includes tests/game/loadout-ai-controller.test.ts
```

The uses of a clock or system randomness listed below are all outside the simulation:

| Location | Use |
| --- | --- |
| `src/lab/app.ts` | `performance.now()` driving the render loop — presentation only |
| `src/worker/auth/session.ts` | `Date.now()` for session expiry |
| `src/worker/routes/login.ts` | `Date.now()` for expiry handling |
| `src/worker/player-identity.ts` | `crypto.randomUUID()` minting an opaque player id |

The simulation's own randomness is a seeded 32-bit xorshift in
`src/combat/simulation/rng.ts`, carried **inside `SimState`** so a rollback restores it.

## Data

No player data is sent to any model or third-party service, because there is no model and
no third-party service. The only data the system stores is the player's own save, held
against an opaque random identifier that carries nothing about the person.

## Relationship to other WizardGang projects

Hexframe's AI is deterministic game AI. This is **not** the same as YarReader's classifier,
which is genuinely model-backed. Do not reuse this document's wording there, or that one's
here.
