import { describe, expect, it } from "vitest";
import { createSim, runFrames } from "../helpers/harness";
import { InputBit, StateId } from "../../src/combat/types";
import { px } from "../../src/combat/constants";
import { isActionable } from "../../src/combat/state/machine";
import { TEST_FIGHTER } from "../../src/content/test-fighter";

describe("walking", () => {
  it("covers exactly the character's forward speed each frame", () => {
    const sim = createSim();
    const startX = sim.getState().fighters[0].x;
    runFrames(sim, 10, (_f, player) => (player === 0 ? InputBit.Right : 0));
    // Player 0 faces right, so Right is forward: 2 px a frame, ten frames.
    expect(sim.getState().fighters[0].x - startX).toBe(TEST_FIGHTER.walkForwardSpeed * 10);
    expect(sim.getState().fighters[0].state).toBe(StateId.WalkForward);
  });

  it("walks backward more slowly than forward", () => {
    const sim = createSim();
    const startX = sim.getState().fighters[0].x;
    runFrames(sim, 10, (_f, player) => (player === 0 ? InputBit.Left : 0));
    expect(startX - sim.getState().fighters[0].x).toBe(TEST_FIGHTER.walkBackwardSpeed * 10);
    expect(sim.getState().fighters[0].state).toBe(StateId.WalkBackward);
  });

  it("treats a horizontal double-tap as ordinary walking", () => {
    const sim = createSim();
    const fighter = sim.getState().fighters[0];

    sim.step([InputBit.Right, 0]);
    sim.step([0, 0]);
    const beforeSecondTap = fighter.x;

    sim.step([InputBit.Right, 0]);
    expect(fighter.state).toBe(StateId.WalkForward);
    expect(fighter.vx).toBe(TEST_FIGHTER.walkForwardSpeed);
    expect(fighter.x - beforeSecondTap).toBe(TEST_FIGHTER.walkForwardSpeed);

    sim.step([InputBit.Right, 0]);
    expect(fighter.state).toBe(StateId.WalkForward);
    expect(fighter.vx).toBe(TEST_FIGHTER.walkForwardSpeed);
    expect(fighter.x - beforeSecondTap).toBe(TEST_FIGHTER.walkForwardSpeed * 2);
  });

  it("crouches rather than walking when down and a direction are held together", () => {
    const sim = createSim();
    runFrames(sim, 4, (_f, player) => (player === 0 ? InputBit.Down | InputBit.Right : 0));
    expect(sim.getState().fighters[0].state).toBe(StateId.Crouch);
    expect(sim.getState().fighters[0].vx).toBe(0);
  });
});

describe("jumping", () => {
  it("spends the authored jump squat on the ground, then leaves it", () => {
    const sim = createSim();
    // Hold up for one frame; the squat is committed and does not need the key held.
    runFrames(sim, 4, (frame, player) => (player === 0 && frame === 0 ? InputBit.Up : 0));
    // Frames 0-3 are the four squat frames.
    expect(sim.getState().fighters[0].state).toBe(StateId.JumpSquat);
    expect(sim.getState().fighters[0].airborne).toBe(0);

    runFrames(sim, 1);
    expect(sim.getState().fighters[0].state).toBe(StateId.Airborne);
    expect(sim.getState().fighters[0].airborne).toBe(1);
  });

  it("rises to the authored apex and lands after 31 airborne frames", () => {
    const sim = createSim();
    runFrames(sim, 4, (frame, player) => (player === 0 && frame === 0 ? InputBit.Up : 0));

    let apex = 0;
    let airborneFrames = 0;
    let launched = false;
    for (let i = 0; i < 60; i++) {
      runFrames(sim, 1);
      const f = sim.getState().fighters[0];
      if (f.airborne === 1) {
        launched = true;
        airborneFrames++;
        apex = Math.max(apex, f.y);
      } else if (launched) {
        // The final integration step travels from y > 0 to the ground and is the 31st
        // airborne simulation frame, even though the post-step state is now grounded.
        airborneFrames++;
        break;
      }
    }

    expect(apex).toBe(px(72));
    expect(airborneFrames).toBe(31);
  });

  it("owes landing recovery, during which it cannot act", () => {
    const sim = createSim();
    runFrames(sim, 4, (frame, player) => (player === 0 && frame === 0 ? InputBit.Up : 0));
    // The launch happens at the start of the frame after the four squat frames.
    runFrames(sim, 1);
    for (let i = 0; i < 60 && sim.getState().fighters[0].airborne === 1; i++) runFrames(sim, 1);

    // The landing frame itself plus the authored recovery.
    expect(sim.getState().fighters[0].state).toBe(StateId.Landing);
    expect(isActionable(sim.getState().fighters[0])).toBe(false);
    runFrames(sim, TEST_FIGHTER.landingFrames - 1);
    expect(sim.getState().fighters[0].state).toBe(StateId.Landing);
    runFrames(sim, 1);
    expect(sim.getState().fighters[0].state).toBe(StateId.Idle);
    expect(isActionable(sim.getState().fighters[0])).toBe(true);
  });
});
