import { describe, expect, it } from "vitest";

import { SCALE } from "../../src/combat/constants";
import type { MoveDef } from "../../src/combat/types";
import { MoveId, TEST_FIGHTER } from "../../src/content/test-fighter";
import {
  FIGHTLAB_CLIPS,
  FIGHTLAB_RIG,
  FIGHTLAB_STANDING_SCALE,
} from "../../src/renderer/character/fightlab-assets";
import type { FightLabClipName } from "../../src/renderer/character/fightlab-presentation";
import { forwardKinematics, inBone } from "../../src/rig/fk";
import { sampleClip } from "../../src/rig/sample";

const STRIKES: readonly {
  moveId: number;
  clip: FightLabClipName;
  bone: "forearm-front" | "shin-front";
}[] = [
  { moveId: MoveId.Jab, clip: "labStrike", bone: "forearm-front" },
  { moveId: MoveId.Sweep, clip: "sweep", bone: "shin-front" },
  { moveId: MoveId.Overhead, clip: "labOverhead", bone: "forearm-front" },
  { moveId: MoveId.Uppercut, clip: "uppercut", bone: "forearm-front" },
];

function move(moveId: number): MoveDef {
  const found = TEST_FIGHTER.moves.find((candidate) => candidate.id === moveId);
  if (!found) throw new Error(`missing move ${moveId}`);
  return found;
}

describe("kit clip contact alignment", () => {
  it("keeps each move on the duration of the clip that presents it", () => {
    for (const strike of STRIKES) {
      expect(move(strike.moveId).duration, strike.clip).toBe(FIGHTLAB_CLIPS[strike.clip].duration);
    }
  });

  it("keeps the striking limb tip inside the authoritative hitbox throughout every active frame", () => {
    for (const strike of STRIKES) {
      const attack = move(strike.moveId);
      const hitbox = attack.hitboxes[0].box;
      const bone = FIGHTLAB_RIG.byName.get(strike.bone);
      expect(bone?.tip, strike.bone).not.toBeNull();

      for (let frame = attack.startup; frame < attack.startup + attack.active; frame++) {
        const pose = sampleClip(FIGHTLAB_CLIPS[strike.clip], frame);
        const placed = forwardKinematics(FIGHTLAB_RIG, pose);
        const tip = inBone(placed.get(strike.bone)!, bone!.tip!);
        const x = tip.x * FIGHTLAB_STANDING_SCALE * SCALE;
        const y = -tip.y * FIGHTLAB_STANDING_SCALE * SCALE;

        expect(x, `${strike.clip} frame ${frame} x`).toBeGreaterThanOrEqual(hitbox.x);
        expect(x, `${strike.clip} frame ${frame} x`).toBeLessThanOrEqual(hitbox.x + hitbox.w);
        expect(y, `${strike.clip} frame ${frame} y`).toBeGreaterThanOrEqual(hitbox.y);
        expect(y, `${strike.clip} frame ${frame} y`).toBeLessThanOrEqual(hitbox.y + hitbox.h);
      }
    }
  });
});
