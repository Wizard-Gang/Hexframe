import type { Aabb, DebugBoxes } from "../../combat/types";
import { SCALE } from "../../combat/constants";
import { SVG_NS, fmt } from "./stage";

function box(layer: SVGGElement, aabb: Aabb, className: string): void {
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", fmt(aabb.x0 / SCALE));
  rect.setAttribute("y", fmt(-aabb.y1 / SCALE));
  rect.setAttribute("width", fmt((aabb.x1 - aabb.x0) / SCALE));
  rect.setAttribute("height", fmt((aabb.y1 - aabb.y0) / SCALE));
  rect.setAttribute("class", className);
  layer.appendChild(rect);
}

export function drawHitboxes(layer: SVGGElement, boxes: DebugBoxes, visible: boolean): void {
  layer.replaceChildren();
  if (!visible) return;
  for (const value of boxes.pushboxes) box(layer, value, "debug-box debug-pushbox");
  for (const values of boxes.hurtboxes) for (const value of values) box(layer, value, "debug-box debug-hurtbox");
  for (const values of boxes.hitboxes) for (const value of values) box(layer, value, "debug-box debug-hitbox");
}
