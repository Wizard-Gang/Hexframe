import type { Placed } from "../../rig/fk";
import { inBone } from "../../rig/fk";
import type { VisualFacing } from "../../rig/paint-order";
import type { Rig } from "../../rig/types";
import { SVG_NS, fmt } from "./stage";

export const MOTION_TRAIL_FRAMES = 6;

export type StrikeBoneName = "forearm-front" | "shin-front";

export interface TrailPoint {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The already-authored striking limb for each move in the fixed four-button kit. */
export function strikingBoneForMove(moveKey: string | undefined): StrikeBoneName | null {
  if (moveKey === "sweep") return "shin-front";
  if (moveKey === "jab" || moveKey === "overhead" || moveKey === "uppercut") return "forearm-front";
  return null;
}

/** Resolve one FK tip in rig-local coordinates. */
export function strikingTip(
  placed: ReadonlyMap<string, Placed>,
  rig: Rig,
  boneName: StrikeBoneName,
): Point | null {
  const at = placed.get(boneName);
  const bone = rig.byName.get(boneName);
  if (!at || !bone?.tip) return null;
  return inBone(at, bone.tip);
}

/** Mirror a local rig point around the fighter origin and place it in screen coordinates. */
export function placeTrailPoint(
  local: Point,
  origin: Point,
  facing: VisualFacing,
  scale: number,
): Point {
  return {
    x: origin.x + local.x * scale * facing,
    y: origin.y + local.y * scale,
  };
}

/**
 * Keep only the last six presentation frames and add at most one sample per simulation frame.
 * This history is renderer-owned and never feeds back into combat.
 */
export function sampleMotionTrail(
  history: readonly TrailPoint[],
  frame: number,
  point: Point | null,
): TrailPoint[] {
  const live = history.filter((candidate) => {
    const age = frame - candidate.frame;
    return age >= 0 && age < MOTION_TRAIL_FRAMES;
  });

  if (point !== null && !live.some((candidate) => candidate.frame === frame)) {
    live.push({ frame, x: point.x, y: point.y });
  }

  return live.slice(-MOTION_TRAIL_FRAMES);
}

/** Draw tapered line segments from the oldest surviving sample toward the current limb tip. */
export function drawMotionTrails(
  layer: SVGGElement,
  trails: readonly (readonly TrailPoint[])[],
  frame: number,
  reducedMotion: boolean,
): void {
  layer.replaceChildren();
  if (reducedMotion) return;

  for (let player = 0; player < trails.length; player++) {
    const points = trails[player] ?? [];
    for (let index = 1; index < points.length; index++) {
      const from = points[index - 1];
      const to = points[index];
      const age = frame - to.frame;
      if (age < 0 || age >= MOTION_TRAIL_FRAMES) continue;

      const freshness = 1 - age / MOTION_TRAIL_FRAMES;
      const taper = index / Math.max(1, points.length - 1);
      const segment = document.createElementNS(SVG_NS, "line");
      segment.setAttribute("class", `motion-trail__segment fighter-p${player + 1}`);
      segment.setAttribute("x1", fmt(from.x));
      segment.setAttribute("y1", fmt(from.y));
      segment.setAttribute("x2", fmt(to.x));
      segment.setAttribute("y2", fmt(to.y));
      segment.setAttribute("stroke-width", fmt(1.2 + 4 * freshness * taper));
      segment.setAttribute("opacity", fmt(0.12 + 0.72 * freshness * taper));
      layer.appendChild(segment);
    }
  }
}
