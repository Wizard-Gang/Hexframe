import { appendTrustedMarkup } from "../../client/trusted-markup";
import { forwardKinematics, inBone } from "../../rig/fk";
import type { Placed } from "../../rig/fk";
import { visualPaintOrder } from "../../rig/paint-order";
import type { VisualFacing } from "../../rig/paint-order";
import type { Pose } from "../../rig/clip-types";
import type { Rig } from "../../rig/types";
import { SVG_NS, fmt } from "../svg/stage";

export interface FigureModel {
  readonly rig: Rig;
  readonly parts: Readonly<Record<string, string>>;
}

function element<K extends keyof SVGElementTagNameMap>(name: K, className?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  if (className) node.setAttribute("class", className);
  return node;
}

/**
 * Parse one repository-owned machine-generated part through Hexframe's sole trusted-markup
 * boundary, then move the already-parsed SVG children into the bone group.
 */
function appendPart(target: SVGGElement, boneName: string, markup: string): void {
  const host = document.createElement("div");
  appendTrustedMarkup(host, markup);
  const svg = host.firstElementChild;
  if (
    !svg
    || svg.namespaceURI !== SVG_NS
    || svg.tagName.toLowerCase() !== "svg"
    || svg.getAttribute("data-bone") !== boneName
    || host.childElementCount !== 1
  ) {
    throw new Error(`FightLab part for '${boneName}' is not the expected SVG`);
  }
  for (const child of Array.from(svg.childNodes)) target.appendChild(child);
}

/** A flat FightLab figure: one transformed group per FK bone plus a presentation-only skeleton. */
export class FigureView {
  readonly model: FigureModel;
  readonly root: SVGGElement;
  private readonly body: SVGGElement;
  private readonly bones = new Map<string, SVGGElement>();
  private readonly skeleton: SVGGElement;
  private painted = "";

  constructor(model: FigureModel) {
    this.model = model;
    this.root = element("g", "fighter");
    this.root.dataset.figure = "fightlab";
    this.body = element("g", "fighter__body");

    for (const bone of model.rig.bones) {
      const group = element("g");
      group.dataset.bone = bone.name;
      const markup = model.parts[bone.name];
      if (!markup) throw new Error(`FightLab part for '${bone.name}' is missing`);
      appendPart(group, bone.name, markup);
      this.bones.set(bone.name, group);
    }

    this.skeleton = element("g", "skeleton");
    this.root.appendChild(this.body);
    this.root.appendChild(this.skeleton);
  }

  pose(pose: Pose, facing: VisualFacing, profile: string): ReadonlyMap<string, Placed> {
    const placed = forwardKinematics(this.model.rig, pose);
    for (const [name, group] of this.bones) {
      const world = placed.get(name);
      if (!world) throw new Error(`FightLab FK placement for '${name}' is missing`);
      group.setAttribute(
        "transform",
        `translate(${fmt(world.x)} ${fmt(world.y)}) rotate(${fmt(world.rotation * 180 / Math.PI)})`,
      );
    }

    const paintKey = `${facing}:${profile}`;
    if (paintKey !== this.painted) {
      this.body.replaceChildren(
        ...visualPaintOrder(this.model.rig, facing, profile).map((name) => {
          const bone = this.bones.get(name);
          if (!bone) throw new Error(`FightLab paint order references missing bone '${name}'`);
          return bone;
        }),
      );
      this.painted = paintKey;
    }
    return placed;
  }

  place(x: number, y: number, facing: VisualFacing, scale: number): void {
    this.root.setAttribute(
      "transform",
      `translate(${fmt(x)} ${fmt(y)}) scale(${fmt(facing * scale)} ${fmt(scale)})`,
    );
  }

  drawSkeleton(placed: ReadonlyMap<string, Placed> | null): void {
    if (placed === null) {
      this.skeleton.replaceChildren();
      return;
    }

    const nodes: SVGElement[] = [];
    for (const bone of this.model.rig.bones) {
      const at = placed.get(bone.name);
      if (!at) continue;
      const ends = [
        ...(bone.parent === null ? [] : [placed.get(bone.parent)]),
        ...(bone.tip === null ? [] : [inBone(at, bone.tip)]),
      ].filter((point): point is Placed | { x: number; y: number } => point !== undefined);
      for (const end of ends) {
        const line = element("line", "skeleton__bone");
        line.setAttribute("x1", fmt(end.x));
        line.setAttribute("y1", fmt(end.y));
        line.setAttribute("x2", fmt(at.x));
        line.setAttribute("y2", fmt(at.y));
        nodes.push(line);
      }
    }
    for (const bone of this.model.rig.bones) {
      const at = placed.get(bone.name);
      if (!at) continue;
      const joint = element("circle", bone.parent === null ? "skeleton__joint skeleton__joint--root" : "skeleton__joint");
      joint.setAttribute("cx", fmt(at.x));
      joint.setAttribute("cy", fmt(at.y));
      joint.setAttribute("r", "1.8");
      nodes.push(joint);
    }
    this.skeleton.replaceChildren(...nodes);
  }
}
