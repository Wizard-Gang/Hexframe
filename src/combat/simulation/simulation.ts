/**
 * The simulation: one frame in, one frame out, and nothing else.
 *
 * `step()` is the whole game. It takes both players' inputs for a frame and advances the
 * match by exactly one 60Hz tick using integer arithmetic. It reads no clock, generates no
 * randomness, touches no DOM and holds no state outside `SimState`. Given the same
 * starting state and the same input sequence, it follows the same path to the same state.
 *
 * Command parsing happens *inside* this loop rather than in front of it. That is why
 * `SimState` carries the input history: parsing is part of the deterministic simulation
 * instead of hidden caller state.
 */

import type {
  CharacterDef,
  Facing,
  FighterState,
  FrameReport,
  InputFrame,
  SimConfig,
  SimState,
  StateIdValue,
} from "../types";
import { StateId } from "../types";
import {
  COMMAND_HISTORY_FRAMES,
  GROUND_Y,
  NO_MOVE,
  STAGE_HALF_WIDTH,
} from "../constants";
import { advanceMove, canStartMove, moveOf, startMove } from "../commands/resolve";
import { resolvePushboxes } from "../collision/pushbox";
import { resolveContacts } from "../hit-resolution/resolve";
import { applyGroundMotion, applyMovement } from "../movement/physics";
import {
  enterState,
  isActionable,
  isCrouching,
  isInStun,
  tickTimers,
} from "../state/machine";
import { readInput, writeInput } from "../../input/buffer/history";
import { commandPressFrame, resolveCommand } from "../../input/parser/command-parser";
import { isBackward, isForward } from "../../input/parser/numpad";

export class Simulation {
  readonly config: SimConfig;
  state: SimState;
  private readonly chars: readonly CharacterDef[];

  constructor(config: SimConfig) {
    this.config = config;
    this.chars = config.characters;
    this.state = Simulation.initialState(config);
  }

  /**
   * The match at frame zero: both fighters idle on the ground at their starting marks,
   * facing each other, at full health, with an empty input history.
   */
  static initialState(config: SimConfig): SimState {
    const fighters: FighterState[] = [];
    if (config.characters.length !== 2) {
      throw new RangeError(`Simulation requires exactly 2 fighters, got ${config.characters.length}`);
    }
    if (config.startX.length !== 2) {
      throw new RangeError(`Simulation requires exactly 2 spawn positions, got ${config.startX.length}`);
    }
    for (let p = 0; p < config.characters.length; p++) {
      const c = config.characters[p];
      const x = config.startX[p];
      const otherX = config.startX[1 - p];
      // At equal starting marks player 0 faces right, for the same reason every other tie
      // in the engine is broken by index: the answer has to be defined somewhere.
      const facing: Facing = x <= otherX ? 1 : -1;
      fighters.push({
        x,
        y: GROUND_Y,
        vx: 0,
        vy: 0,
        facing,
        state: StateId.Idle,
        stateFrame: 0,
        moveId: NO_MOVE,
        moveFrame: 0,
        hitstop: 0,
        stun: 0,
        health: c.health,
        airborne: 0,
        hitFlags: 0,
        comboCount: 0,
        armorHits: 0,
        // -1 rather than 0, so that a press on frame 0 is still newer than "nothing
        // consumed yet" and the very first button of a match is not swallowed.
        bufferConsumedFrame: -1,
      });
    }

    const inputHistory: number[][] = [];
    for (let p = 0; p < config.characters.length; p++) {
      inputHistory.push(new Array<number>(COMMAND_HISTORY_FRAMES).fill(0));
    }

    const stage = config.stage;
    return {
      frame: 0,
      fighters,
      stage: {
        worldMinX: stage?.cameraBounds.minX ?? -STAGE_HALF_WIDTH,
        worldMaxX: stage?.cameraBounds.maxX ?? STAGE_HALF_WIDTH,
      },
      roundOver: 0,
      inputHistory,
    };
  }

  getState(): SimState {
    return this.state;
  }

  /** Replace the state wholesale for a Training reset. */
  setState(next: SimState): void {
    this.state = next;
  }

  characters(): readonly CharacterDef[] {
    return this.chars;
  }

  /**
   * Advance the match by one frame.
   *
   * The numbered steps are the frame loop of the specification, in order. Their order is
   * not decorative: commands are resolved before movement so a press and the stance it was
   * made in agree; pushboxes are settled before hitboxes are tested so nobody is hit
   * through a body they are standing inside; and contacts are resolved last so that every
   * box tested this frame is a box in the position the frame actually ended in.
   */
  step(inputs: readonly InputFrame[]): FrameReport {
    const s = this.state;
    const report: FrameReport = {
      frame: s.frame,
      contacts: [],
      moveStarts: [],
      stateChanges: [],
    };

    const before: StateIdValue[] = s.fighters.map((f) => f.state);
    const frozen: boolean[] = s.fighters.map(() => false);

    // 1. Read input frames. Everything downstream reads the history rather than the
    //    argument, so a re-simulated frame and a live one take exactly the same path.
    for (let p = 0; p < s.fighters.length; p++) {
      writeInput(s, p, s.frame, inputs[p] ?? 0);
    }

    // 2-3. Resolve commands, and update fighter states.
    //
    //      The order inside this loop is the part of the engine most easily got wrong by
    //      a frame, so it is spelled out: a state whose time is up ends *before* anything
    //      else happens, then the timers tick, then the stance is read, then a command is
    //      matched against it. Ending the move first is what makes an 18-frame move
    //      occupy eighteen frames rather than nineteen — the fighter becomes free on the
    //      frame its recovery ends, not on the frame after. Checking the expiry before
    //      ticking the timer that caused it is the same argument applied to stun.
    for (let p = 0; p < s.fighters.length; p++) {
      const f = s.fighters[p];
      const c = this.chars[p];

      if (f.hitstop > 0) {
        tickTimers(f);
        frozen[p] = true;
        continue;
      }
      if (f.state === StateId.Attack) {
        advanceMove(f, c);
      } else if (isInStun(f) && f.stun === 0) {
        this.recoverFromStun(f);
      } else if (f.state === StateId.JumpSquat && f.stateFrame >= c.jumpSquatFrames) {
        this.launch(s, p, f, c);
      } else if (f.state === StateId.Landing && f.stateFrame >= c.landingFrames) {
        enterState(f, StateId.Idle);
      }

      tickTimers(f);


      // The stance is established before the command is matched. Crouching is a stance
      // rather than a move, and a command that requires it — every low in the game — has
      // to be judged against the direction being held now. Deferring the stance to the
      // movement step would mean holding down and pressing light on the same frame gives
      // the standing normal, which is a frame of lag the player did nothing to deserve.
      applyGroundMotion(f, c, readInput(s, p, s.frame));

      const wanted = resolveCommand(s, p, c, f);
      if (wanted === NO_MOVE) continue;
      const m = moveOf(c, wanted);
      if (m === null) continue;
      if (!canStartMove(f, c, m)) continue;

      // The press is consumed only once the move is actually starting. A press the
      // fighter cannot honour yet stays live, which is what makes the input buffer a
      // buffer rather than a discard.
      const pressFrame = commandPressFrame(s, p, c, f, wanted);
      startMove(f, c, m);
      if (pressFrame >= 0) f.bufferConsumedFrame = pressFrame;
      report.moveStarts.push({ player: p, moveId: m.id });
    }

    // 4. Apply movement.
    for (let p = 0; p < s.fighters.length; p++) {
      if (frozen[p]) continue;
      applyMovement(s.fighters[p], this.chars[p]);
    }

    // 5. Resolve facing. Only a grounded, actionable fighter turns: nobody pivots in the
    //    middle of a move or while being hit, which is what keeps a crossup a crossup.
    for (let p = 0; p < s.fighters.length; p++) {
      const f = s.fighters[p];
      const other = s.fighters[1 - p];
      if (frozen[p]) continue;
      if (f.airborne === 1 || !isActionable(f)) continue;
      if (other.x > f.x) f.facing = 1;
      else if (other.x < f.x) f.facing = -1;
    }

    // 6. Generate pushboxes, separate the fighters and hold them inside the stage.
    resolvePushboxes(s, this.chars);

    // 7-10. Hurtboxes, attack hitboxes, intersection, and hits, blocks and throws.
    //       All four are one call: a box is only interesting at the moment it is tested,
    //       and building intermediate lists nobody keeps would be work for its own sake.
    resolveContacts(s, this.chars, inputs, report);

    // 11-13. Hitstop, stun and health were written by step 10. They are decremented at
    //        the top of the following frame, so a hitstop of 7 freezes exactly 7 frames.

    // 15-17. A state entered during this frame is on its frame 0 for the whole of it and
    //        ages at the end, which is what lets the checks at the top of the next frame
    //        read `stateFrame` as "frames already spent here".
    for (let p = 0; p < s.fighters.length; p++) {
      if (!frozen[p]) s.fighters[p].stateFrame++;
      const from = before[p];
      const to = s.fighters[p].state;
      if (from !== to) report.stateChanges.push({ player: p, from, to });
    }
    s.frame++;
    return report;
  }

  /**
   * Leave hitstun or blockstun.
   *
   * The stance is read from the state being left rather than from live input so recovery
   * is determined by authoritative simulation state. A fighter still in the air goes back
   * to falling; the combo counter resets here because this is the exact moment the defender
   * is free again.
   */
  private recoverFromStun(f: FighterState): void {
    if (f.airborne === 1) {
      enterState(f, StateId.Airborne);
    } else {
      enterState(f, isCrouching(f) ? StateId.Crouch : StateId.Idle);
    }
    f.comboCount = 0;
  }

  /**
   * Leave the ground at the end of a jump squat.
   *
   * The direction the jump carries is the one that was held when the squat began, read
   * back out of the authoritative input history rather than kept in a field of its own.
   */
  private launch(s: SimState, player: number, f: FighterState, c: CharacterDef): void {
    const enteredAt = s.frame - f.stateFrame;
    const held = readInput(s, player, enteredAt);
    f.airborne = 1;
    f.vy = c.jumpVelocityY;
    if (isForward(held, f.facing)) f.vx = c.jumpVelocityXForward * f.facing;
    else if (isBackward(held, f.facing)) f.vx = c.jumpVelocityXBackward * f.facing;
    else f.vx = 0;
    enterState(f, StateId.Airborne);
  }

}
