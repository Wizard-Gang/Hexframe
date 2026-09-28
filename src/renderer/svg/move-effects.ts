import type { MoveDef } from "../../combat/types";
import { fmt, SVG_NS } from "./stage";

export type MoveEffectKind = "fire" | "freeze" | "physical";
export type MoveEffectAnchor = "hand_near" | "hand_far" | "foot_near" | "foot_far" | "head" | "chest" | "pelvis" | "ground" | "hitbox_center";
export type MoveEffectLayer = "telegraph" | "trail" | "residue";

export interface MoveEffectProfile {
  kind: MoveEffectKind;
  primary: string;
  secondary: string;
  count: number;
  radius: number;
  spin: number;
  rotation: number;
  shape: number;
  effect: string;
  trail: string;
  impact: string;
  anchor: MoveEffectAnchor;
  coreRadius: number;
}

export interface MoveVisualDefinition {
  effect: string;
  trail: string;
  impact: string;
  offsetX: number;
  offsetY: number;
  anchor: MoveEffectAnchor;
  count: number;
  radius: number;
  spin: number;
  rotation: number;
  shape: number;
  coreRadius: number;
  windows: Readonly<Record<MoveEffectLayer, readonly [number, number]>>;
}

function visual(
  effect: string,
  trail: string,
  impact: string,
  anchor: MoveEffectAnchor,
  offsetX: number,
  offsetY: number,
  particles: readonly [number, number, number, number, number, number],
  timing: readonly [number, number, number, number],
): MoveVisualDefinition {
  return {
    effect, trail, impact, anchor, offsetX, offsetY,
    count: particles[0], radius: particles[1], spin: particles[2], rotation: particles[3], shape: particles[4], coreRadius: particles[5],
    windows: { telegraph: [0, timing[0]], trail: [timing[1], timing[2]], residue: [timing[2] + 1, timing[3]] },
  };
}

/** Presentation vocabulary for the two schema fixtures and four playable techniques. */
export const MOVE_VISUALS: Readonly<Record<string, MoveVisualDefinition>> = {
  standing_light: visual("knuckle_flash", "short_speed_lines", "white_cross", "hand_near", 2, 0, [3, 12, 4, 0, 1, 3], [2, 3, 6, 10]),
  crouching_light: visual("low_streak", "floor_dust", "low_cross", "hand_near", 3, 2, [3, 14, 3, 8, 1, 3], [3, 4, 7, 12]),
  ember_palm: visual("palm_burst", "embers", "fire_disc", "hand_near", 2, 0, [4, 18, 3, 12, 0, 4], [5, 6, 11, 16]),
  frost_heel: visual("heel_comet", "ice_dust", "ice_star", "foot_near", 4, -1, [4, 22, -2, 42, 2, 4], [7, 8, 13, 19]),
  ashen_sweep: visual("ground_arc", "flame_floor", "ember_spray", "ground", 42, -2, [4, 27, 2, 0, 1, 4], [6, 7, 13, 19]),
  phoenix_drive: visual("rising_spiral", "phoenix_feathers", "fire_spiral", "chest", 12, -15, [5, 31, 5, 10, 2, 5], [7, 8, 15, 23]),
};

const DEFAULT_VISUAL: MoveVisualDefinition = {
  effect: "impact_orbit",
  trail: "dust",
  impact: "physical_burst",
  offsetX: 44,
  offsetY: -52,
  anchor: "hitbox_center",
  count: 3,
  radius: 18,
  spin: 3,
  rotation: 0,
  shape: 1,
  coreRadius: 4,
  windows: { telegraph: [0, 3], trail: [4, 9], residue: [10, 14] },
};

export function moveVisualDefinition(moveKey: string): MoveVisualDefinition {
  return MOVE_VISUALS[moveKey] ?? DEFAULT_VISUAL;
}

const COLORS: Record<MoveEffectKind, readonly [string, string]> = {
  fire: ["#ff9a4d", "#ffd36a"],
  freeze: ["#78dcff", "#e0f8ff"],
  physical: ["#f1d29a", "#ffffff"],
};

/** A stable authored visual signature. Combat never reads it. */
export function moveEffectProfile(
  _moveId: number,
  tags: readonly string[],
  moveKey = "",
): MoveEffectProfile {
  const kind = effectKind(tags);
  const colors = COLORS[kind];
  const visual = moveVisualDefinition(moveKey);
  return {
    kind,
    primary: colors[0],
    secondary: colors[1],
    count: visual.count,
    radius: visual.radius,
    spin: visual.spin,
    rotation: visual.rotation,
    shape: visual.shape,
    effect: visual.effect,
    trail: visual.trail,
    impact: visual.impact,
    anchor: visual.anchor,
    coreRadius: visual.coreRadius,
  };
}

export function drawMoveParticles(
  layer: SVGGElement,
  move: MoveDef,
  x: number,
  y: number,
  facing: number,
  frame: number,
  scale = 1,
): void {
  const profile = moveEffectProfile(move.id, move.tags, move.key);
  const visual = moveVisualDefinition(move.key);
  const effectLayer = layerAt(visual, frame);
  if (effectLayer === null) return;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `move-particles effect-${profile.kind} move-effect-${move.id}`);
  group.setAttribute("data-move-id", String(move.id));
  group.setAttribute("data-effect", visual.effect);
  group.setAttribute("data-trail", visual.trail);
  group.setAttribute("data-impact", visual.impact);
  group.setAttribute("data-layer", effectLayer);
  group.setAttribute("data-anchor", visual.anchor);
  group.setAttribute("transform", `translate(${fmt(x + facing * visual.offsetX)} ${fmt(y + visual.offsetY)}) scale(${fmt(scale)})`);

  drawTechniqueMotif(group, visual.effect, profile, facing, frame);

  const core = document.createElementNS(SVG_NS, "circle");
  core.setAttribute("class", "move-particle move-particle-core");
  core.setAttribute("r", fmt(profile.coreRadius + (frame % 4) * 0.3));
  core.setAttribute("fill", "none");
  core.setAttribute("stroke", profile.secondary);
  core.setAttribute("stroke-width", "1.5");
  group.appendChild(core);

  const pulse = (frame % 8) * 0.45;
  const ambientCount = Math.max(2, Math.floor(profile.count / 2));
  for (let index = 0; index < ambientCount; index++) {
    const degrees = profile.rotation + (360 / ambientCount) * index + frame * profile.spin;
    const radians = degrees * Math.PI / 180;
    const orbit = profile.radius + pulse + (index % 3) * 4;
    const px = Math.cos(radians) * orbit;
    const py = Math.sin(radians) * orbit * 0.72;
    group.appendChild(particleShape(profile, index, px, py, degrees));
  }
  layer.appendChild(group);
}

export function styleImpact(group: SVGGElement, move: MoveDef): MoveEffectProfile {
  const profile = moveEffectProfile(move.id, move.tags, move.key);
  group.setAttribute("class", `contact-burst effect-${profile.kind} move-effect-${move.id}`);
  group.setAttribute("data-move-id", String(move.id));
  group.setAttribute("data-impact", profile.impact);
  group.style.color = profile.primary;
  return profile;
}

function drawTechniqueMotif(
  group: SVGGElement,
  effect: string,
  profile: MoveEffectProfile,
  facing: number,
  frame: number,
): void {
  const motif = document.createElementNS(SVG_NS, "g");
  motif.setAttribute("class", `technique-motif motif-${effect}`);
  motif.setAttribute("transform", `scale(${facing} 1)`);
  motif.style.color = profile.primary;

  const pulse = 1 + (frame % 6) * 0.05;
  if (effect === "palm_burst") {
    motif.appendChild(ring(0, 0, 14 * pulse, profile.secondary));
    for (let i = 0; i < 4; i++) {
      motif.appendChild(ray(0, 0, 8, 25 + (i % 2) * 7, i * 90, i % 2 ? profile.secondary : profile.primary));
    }
  } else if (effect === "ground_arc") {
    motif.appendChild(curve("M -28 7 Q 8 -4 48 4", profile.primary, 4));
    motif.appendChild(curve("M -20 12 Q 12 2 40 9", profile.secondary, 2));
  } else if (effect === "heel_comet") {
    for (const [i, offset] of [0, 13, 25].entries()) {
      motif.appendChild(shard(offset, offset * 0.7, 7 + i * 2, 22 + i * 6, i % 2 ? profile.secondary : profile.primary, -8));
    }
  } else if (effect === "rising_spiral") {
    motif.appendChild(curve("M -12 28 C 25 12 -24 -10 12 -34", profile.primary, 5));
    motif.appendChild(curve("M 10 29 C -20 10 22 -12 -7 -40", profile.secondary, 2));
  } else if (effect === "knuckle_flash" || effect === "low_streak") {
    for (let i = 0; i < 2; i++) {
      motif.appendChild(polyline(`${-26 - i * 4},${-7 + i * 7} ${32 + i * 5},${-2 + i * 4}`, i % 2 ? profile.secondary : profile.primary, 3));
    }
  } else {
    motif.appendChild(ring(0, 0, 16 * pulse, profile.primary));
    motif.appendChild(ray(0, 0, 7, 28, profile.rotation + frame * profile.spin, profile.secondary));
  }
  group.appendChild(motif);
}

function ring(cx: number, cy: number, radius: number, color: string): SVGCircleElement {
  const value = document.createElementNS(SVG_NS, "circle");
  value.setAttribute("cx", fmt(cx)); value.setAttribute("cy", fmt(cy)); value.setAttribute("r", fmt(radius));
  value.setAttribute("fill", "none"); value.setAttribute("stroke", color); value.setAttribute("stroke-width", "2");
  return value;
}

function ray(x: number, y: number, inner: number, outer: number, degrees: number, color: string): SVGLineElement {
  const value = document.createElementNS(SVG_NS, "line");
  value.setAttribute("x1", fmt(x + inner)); value.setAttribute("y1", fmt(y));
  value.setAttribute("x2", fmt(x + outer)); value.setAttribute("y2", fmt(y));
  value.setAttribute("stroke", color); value.setAttribute("stroke-width", "2");
  value.setAttribute("transform", `rotate(${fmt(degrees)} ${fmt(x)} ${fmt(y)})`);
  return value;
}

function curve(path: string, color: string, width: number): SVGPathElement {
  const value = document.createElementNS(SVG_NS, "path");
  value.setAttribute("d", path); value.setAttribute("fill", "none"); value.setAttribute("stroke", color);
  value.setAttribute("stroke-width", fmt(width)); value.setAttribute("stroke-linecap", "round");
  return value;
}

function polyline(points: string, color: string, width: number): SVGPolylineElement {
  const value = document.createElementNS(SVG_NS, "polyline");
  value.setAttribute("points", points); value.setAttribute("fill", "none"); value.setAttribute("stroke", color);
  value.setAttribute("stroke-width", fmt(width)); value.setAttribute("stroke-linecap", "round"); value.setAttribute("stroke-linejoin", "round");
  return value;
}

function shard(x: number, y: number, width: number, height: number, color: string, rotation: number): SVGPolygonElement {
  const value = document.createElementNS(SVG_NS, "polygon");
  value.setAttribute("points", `0,${fmt(-height / 2)} ${fmt(width / 2)},0 0,${fmt(height / 2)} ${fmt(-width / 2)},0`);
  value.setAttribute("fill", color); value.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(rotation)})`);
  return value;
}

function effectKind(tags: readonly string[]): MoveEffectKind {
  if (tags.includes("fire") || tags.includes("burn")) return "fire";
  if (tags.includes("cold") || tags.includes("freeze")) return "freeze";
  return "physical";
}

function particleShape(
  profile: MoveEffectProfile,
  index: number,
  x: number,
  y: number,
  degrees: number,
): SVGElement {
  const shape = (profile.shape + index) % 4;
  const color = index % 2 === 0 ? profile.primary : profile.secondary;
  if (shape === 0) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "move-particle particle-orb");
    circle.setAttribute("cx", fmt(x));
    circle.setAttribute("cy", fmt(y));
    circle.setAttribute("r", fmt(2 + (index % 3)));
    circle.setAttribute("fill", color);
    return circle;
  }
  if (shape === 1) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "move-particle particle-streak");
    line.setAttribute("x1", fmt(x * 0.55));
    line.setAttribute("y1", fmt(y * 0.55));
    line.setAttribute("x2", fmt(x));
    line.setAttribute("y2", fmt(y));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", fmt(1 + (profile.shape % 3)));
    return line;
  }
  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute("class", `move-particle ${shape === 2 ? "particle-shard" : "particle-rune"}`);
  polygon.setAttribute("points", shape === 2 ? "0,-6 3,0 0,6 -3,0" : "0,-5 5,4 -5,4");
  polygon.setAttribute("fill", shape === 2 ? color : "none");
  polygon.setAttribute("stroke", color);
  polygon.setAttribute("stroke-width", "1");
  polygon.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)}) rotate(${fmt(degrees)})`);
  return polygon;
}

function layerAt(visual: MoveVisualDefinition, frame: number): MoveEffectLayer | null {
  for (const layer of ["telegraph", "trail", "residue"] as const) {
    const [start, end] = visual.windows[layer];
    if (frame >= start && frame <= end) return layer;
  }
  return null;
}
