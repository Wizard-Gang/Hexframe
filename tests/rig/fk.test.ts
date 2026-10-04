import { describe, expect, it } from "vitest";

import { forwardKinematics, inBone } from "../../src/rig/fk";
import { rig } from "./fixtures";

describe("FightLab forward kinematics", () => {
  it("places the committed 11-bone rest pose in rig space", () => {
    const rest = forwardKinematics(rig, {});
    expect(rest.size).toBe(11);
    expect(rest.get("pelvis")).toMatchObject({ x: 0, y: -42, rotation: 0 });
    expect(rest.get("torso")).toMatchObject({ x: 0, y: -48, rotation: 0 });
    expect(rest.get("head")).toMatchObject({ x: 0, y: -79, rotation: 0 });
  });

  it("carries child joints and bone-local tips through parent rotation", () => {
    const turned = forwardKinematics(rig, { torso: { rotation: 90 } });
    expect(turned.get("torso")!.rotation).toBeCloseTo(Math.PI / 2, 10);
    expect(turned.get("head")!.x).toBeCloseTo(31, 10);
    expect(turned.get("head")!.y).toBeCloseTo(-48, 10);

    const rest = forwardKinematics(rig, {});
    const forearm = rest.get("forearm-front")!;
    const tip = rig.byName.get("forearm-front")!.tip!;
    expect(inBone(forearm, tip)).toEqual({ x: 11, y: -26 });
  });
});
