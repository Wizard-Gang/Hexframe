# TEST_FIGHTER — authored values

These are the numbers the content, test and lab work is written against. They are
authored in **world pixels and frames**; `src/content/loader.ts` multiplies lengths and
velocities by `SCALE` and is the only place that conversion happens. Decimals are allowed
in authored data to two places, because `px()` truncates `n * 100` exactly.

The fighter is a test instrument, not the hero. Its job is to exercise the engine.

## `characters/test_fighter/character.json`

| field | value | note |
|---|---|---|
| `id` | `test_fighter` | |
| `name` | `Test Fighter` | |
| `health` | 1000 | |
| `walkForwardSpeed` | 2 | px/frame |
| `walkBackwardSpeed` | 1.5 | px/frame |
| `dashSpeed` | 5 | px/frame |
| `dashDuration` | 14 | frames |
| `jumpVelocityY` | 9 | px/frame |
| `jumpVelocityXForward` | 3 | px/frame |
| `jumpVelocityXBackward` | -3 | px/frame, negative = away from facing |
| `jumpSquatFrames` | 4 | |
| `landingFrames` | 3 | |
| `gravity` | 0.6 | px/frame², subtracted from `vy` each airborne frame |
| `groundFriction` | 0.4 | px/frame decay of residual `vx` while grounded |

A jump therefore rises for 15 frames to an apex of 72 px, holds that apex for a single
frame, and is airborne for 31 frames — plus 4 frames of jump squat before it and 3 of
landing recovery after. Those figures follow from integrating position before gravity, so
the first airborne frame travels at the full launch velocity: height after `n` frames is
`n * (930 - 30n)` sim units, which is zero again at `n = 31`.

### Boxes (fighter-local: `x` forward from the ground origin, `y` up from the ground)

```
pushboxStand    { "x": -18, "y":  0, "w": 36, "h": 96 }
pushboxCrouch   { "x": -18, "y":  0, "w": 36, "h": 62 }
pushboxAir      { "x": -16, "y":  0, "w": 32, "h": 84 }

hurtboxesStand  [ { "x": -16, "y":  0, "w": 32, "h": 44 },     legs
                  { "x": -18, "y": 44, "w": 36, "h": 38 },     torso
                  { "x": -14, "y": 82, "w": 28, "h": 22 } ]    head        → 104 px tall

hurtboxesCrouch [ { "x": -18, "y":  0, "w": 36, "h": 34 },
                  { "x": -18, "y": 34, "w": 36, "h": 22 },
                  { "x": -14, "y": 56, "w": 28, "h": 20 } ]                → 76 px tall

hurtboxesAir    [ { "x": -16, "y":  0, "w": 32, "h": 40 },
                  { "x": -16, "y": 40, "w": 32, "h": 34 },
                  { "x": -13, "y": 74, "w": 26, "h": 20 } ]                → 94 px tall
```

A symmetric box stays symmetric under mirroring, which is the point of authoring `x` as
forward-relative rather than as a left edge.

## `characters/test_fighter/moves/standing_light.json`

```
id            1
key           standing_light
animation     standing_light
duration      18          startup 4    active 2    recovery 12
requiresCrouch false      airOk false
```

One hitbox:

```
id            1
startFrame    4      endFrame 5          (0-based, inclusive — the active frames)
box           { "x": 26, "y": 62, "w": 44, "h": 20 }
level         "mid"
damage        30
hitstun       14      blockstun 9
hitstopAttacker 7     hitstopDefender 9
pushbackHitAttacker   -1.2      pushbackHitDefender   3.0
pushbackBlockAttacker -1.8      pushbackBlockDefender 2.4
```

Pushback is signed along the **attacker's** facing, which is why the attacker's own value
is negative — it moves them backwards. `hurtboxWindows`, `invulWindows` and `movement`
are empty: this move changes nothing about the fighter's vulnerability and moves them
nowhere. Its on-hit cancel window opens the route builder to every other catalog move.

Reach, given the boxes above: the hitbox spans 26–70 px in front of the origin and the
opponent's hurtboxes span ±18 px around theirs, so standing light connects at a separation
of 36 px (pushboxes touching) up to 88 px. Vertically it spans 62–82 px, which catches a
standing opponent's torso and a crouching opponent's head — it is a mid, and it hits a
crouching opponent who is not blocking.

## `characters/test_fighter/moves/crouching_light.json`

The second move exists to prove the data-driven design carries a different stance and a
different guard level without an engine change. No new engine feature is written for it.

```
id            2
key           crouching_light
animation     crouching_light
duration      16          startup 4    active 3    recovery 9
requiresCrouch true       airOk false

hitbox id 1   startFrame 4   endFrame 6
box           { "x": 22, "y": 12, "w": 42, "h": 18 }
level         "low"
damage        20
hitstun       12     blockstun 8
hitstopAttacker 6    hitstopDefender 8
pushbackHitAttacker   -1.0     pushbackHitDefender   2.2
pushbackBlockAttacker -1.4     pushbackBlockDefender 1.8
```

## Commands

Training builds 16 commands from `DEFAULT_MOVE_LOADOUT`. Slots map directly to `Action1`
through `Action16`; their default move ids are 1 through 16. Commands have no motion,
inherit the move's stance requirement, and receive descending priority by slot. The
current 16-slot assignment remains authored game data and does not change move definitions.

Keyboard arrows and gamepad Y/X/B/A form the same spatial diamond. Shift/LT and Space/RT
select the other three banks, yielding 16 independently assignable inputs.

## Tagged move catalog

There are 24 unique combat definitions and 24 distinct animation names. Moves 1 and 2
are the authored JSON normals above; moves 3–24 live in
`src/content/additional-moves.ts` and cover fire/burn, chaos/poison, cold/freeze,
lightning/shock, physical/bleed and void/control routes. Tags and descriptions are
player-facing build vocabulary and deterministic combat rules:

- burn stacks three times, ticks for damage and empowers another burn hit;
- poison stacks five times and increases each periodic tick;
- freeze stacks slow movement, with the third stack freezing for 24 frames;
- shock stacks are consumed by the next direct hit for bonus damage;
- bleed deals movement-triggered damage and is consumed by an execute-tagged move.

Every duration, tick cadence, stack cap and payoff uses integer frame state and is part
of rollback snapshots and hashes.

Every move has an on-hit cancel window into the other 23 moves. That makes the catalog a
route-construction prototype while keeping actual combat resolution deterministic and
data-driven.

## Match setup

Both fighters are `test_fighter`. Player 0 starts at `-120` px facing right, player 1 at
`+120` px facing left — 240 px apart, comfortably outside standing light's 88 px reach, so
nothing connects until someone walks in. Default RNG seed `0x5eed`.

## Rig and animations

`rig.json` declares the hierarchy of §15 — pelvis → torso → head and the four limb chains
— with a pivot per part. `model.svg` supplies one `<g id="…">` per part, drawn around its
own pivot at the origin. Animations exist for `idle`, `walk_forward`, `walk_backward`,
`crouch`, `jump`, both authored light attacks and all 22 generated catalog attacks.

Animation keyframes are sparse: a frame index and the bones that change on it. The
renderer interpolates between keyframes. **The simulation never reads any of this.** An
animation may be re-timed, re-posed or replaced entirely without a single combat value
moving, and `tests/content` asserts that the animation frame count and the move duration
are allowed to differ, so nobody quietly couples them later.

The move showcase replays these same clips on hover or focus. `move-effects.ts`
derives a stable particle profile from each move id and its tags, so all 24 attacks have
distinct visual signatures in both the showcase and live combat without adding particle
state to snapshots or hashes.
