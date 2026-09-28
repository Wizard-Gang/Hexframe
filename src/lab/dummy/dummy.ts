import type { FrameReport, InputFrame, SimState } from "../../combat/types";
import { ContactKind, InputBit, StateId } from "../../combat/types";
import { isActionable } from "../../combat/state/machine";
import { InputRecorder, InputPlayback } from "../../input/recording/recorder";

export const DummyMode = {
  Stand: 0,
  Crouch: 1,
  Jump: 2,
  BlockNone: 3,
  BlockAll: 4,
  BlockAfterFirstHit: 5,
  Record: 6,
  Playback: 7,
  Counterattack: 8,
  Reversal: 9,
} as const;

export type DummyModeValue = (typeof DummyMode)[keyof typeof DummyMode];

function backInput(state: SimState, player: number): InputFrame {
  const fighter = state.fighters[player];
  const opponent = state.fighters[player === 0 ? 1 : 0];
  if (!opponent) return fighter.facing === 1 ? InputBit.Left : InputBit.Right;
  return opponent.x > fighter.x ? InputBit.Left : InputBit.Right;
}

/** A deterministic input source for the training dummy. It never writes simulation state. */
export class DummyController {
  mode: DummyModeValue = DummyMode.Stand;

  private blockAfterHit = false;
  private capturedInput: InputFrame = 0;
  private readonly recorder = new InputRecorder();
  private playback: InputPlayback | null = null;
  private pendingCounter = false;
  private lastMode: DummyModeValue = this.mode;

  /** Supplies the physical P2 input used by Record mode. */
  capture(input: InputFrame): void {
    this.capturedInput = input;
  }

  inputFor(state: SimState, player: number, lastReport: FrameReport | null): InputFrame {
    this.handleModeChange(state.frame);
    const fighter = state.fighters[player];

    if (lastReport) {
      for (const contact of lastReport.contacts) {
        if (contact.defender !== player) continue;
        if (contact.kind === ContactKind.Hit) this.blockAfterHit = true;
        if (this.mode === DummyMode.Counterattack && contact.kind === ContactKind.Block) {
          this.pendingCounter = true;
        }
      }
      if (this.mode === DummyMode.Reversal) {
        for (const change of lastReport.stateChanges) {
          if (
            change.player === player &&
            (change.to === StateId.Idle || change.to === StateId.Crouch)
          ) {
            this.pendingCounter = true;
          }
        }
      }
    }

    switch (this.mode) {
      case DummyMode.Crouch:
        return InputBit.Down;
      case DummyMode.Jump:
        return isActionable(fighter) && state.frame % 90 === 0 ? InputBit.Up : 0;
      case DummyMode.BlockAll:
        return backInput(state, player);
      case DummyMode.BlockAfterFirstHit:
        return this.blockAfterHit ? backInput(state, player) : 0;
      case DummyMode.Record: {
        this.recorder.record(state.frame, [0, this.capturedInput]);
        return this.capturedInput;
      }
      case DummyMode.Playback:
        return this.playback?.at(state.frame, player) ?? 0;
      case DummyMode.Counterattack:
      case DummyMode.Reversal:
        if (this.pendingCounter && isActionable(fighter)) {
          this.pendingCounter = false;
          return InputBit.Action1;
        }
        return this.mode === DummyMode.Counterattack ? backInput(state, player) : 0;
      case DummyMode.Stand:
      case DummyMode.BlockNone:
      default:
        return 0;
    }
  }

  reset(): void {
    this.blockAfterHit = false;
    this.capturedInput = 0;
    this.pendingCounter = false;
    this.playback = null;
    if (this.recorder.recording) this.recorder.stop();
    // Record mode needs to start a fresh take on the first frame after a reset.
    this.lastMode = this.mode === DummyMode.Record ? DummyMode.Stand : this.mode;
  }

  private handleModeChange(frame: number): void {
    if (this.lastMode === this.mode) return;
    if (this.lastMode === DummyMode.Record && this.recorder.recording) {
      this.playback = new InputPlayback(this.recorder.stop(), true);
    }
    if (this.mode === DummyMode.Record) this.recorder.start(frame);
    this.lastMode = this.mode;
  }
}
