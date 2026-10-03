import type { FrameReport, InputFrame, SimState } from "../../combat/types";
import { ContactKind, InputBit } from "../../combat/types";
import { isActionable } from "../../combat/state/machine";

export const DummyMode = {
  Stand: 0,
  Block: 1,
  FightBack: 2,
} as const;

export type DummyModeValue = (typeof DummyMode)[keyof typeof DummyMode];

function backInput(state: SimState, player: number): InputFrame {
  const fighter = state.fighters[player];
  const opponent = state.fighters[player === 0 ? 1 : 0];
  if (!opponent) return fighter.facing === 1 ? InputBit.Left : InputBit.Right;
  return opponent.x > fighter.x ? InputBit.Left : InputBit.Right;
}

/** A deterministic input source for the three Training dummy behaviors. */
export class DummyController {
  mode: DummyModeValue = DummyMode.Stand;
  private pendingCounter = false;

  inputFor(state: SimState, player: number, lastReport: FrameReport | null): InputFrame {
    const fighter = state.fighters[player];

    if (this.mode === DummyMode.FightBack && lastReport) {
      for (const contact of lastReport.contacts) {
        if (contact.defender === player && contact.kind === ContactKind.Block) {
          this.pendingCounter = true;
        }
      }
    }

    if (this.mode === DummyMode.Block) return backInput(state, player);
    if (this.mode === DummyMode.FightBack) {
      if (this.pendingCounter && isActionable(fighter)) {
        this.pendingCounter = false;
        return InputBit.Action1;
      }
      return backInput(state, player);
    }
    return 0;
  }

  reset(): void {
    this.pendingCounter = false;
  }
}
