import type { MoveDef } from "../../combat/types";
import { fmt, SVG_NS } from "./stage";

export type MoveEffectKind = "fire" | "poison" | "freeze" | "shock" | "bleed" | "void" | "physical" | "prism";
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

/** Presentation vocabulary keyed by technique, kept entirely outside combat MoveDef. */
export const MOVE_VISUALS: Readonly<Record<string, MoveVisualDefinition>> = {
  standing_light: visual("knuckle_flash", "short_speed_lines", "white_cross", "hand_near", 2, 0, [3, 12, 4, 0, 1, 3], [2, 3, 6, 10]),
  crouching_light: visual("low_streak", "floor_dust", "low_cross", "hand_near", 3, 2, [3, 14, 3, 8, 1, 3], [3, 4, 7, 12]),
  ember_palm: visual("palm_burst", "embers", "fire_disc", "hand_near", 2, 0, [4, 18, 3, 12, 0, 4], [5, 6, 11, 16]),
  venom_fang: visual("fang_streak", "venom_thread", "needle_burst", "hand_near", 3, 1, [3, 16, -3, 28, 1, 3], [4, 5, 10, 15]),
  frost_heel: visual("heel_comet", "ice_dust", "ice_star", "foot_near", 4, -1, [4, 22, -2, 42, 2, 4], [7, 8, 13, 19]),
  storm_knuckle: visual("lightning_bolt", "charge_sparks", "electric_cross", "hand_near", 3, 0, [5, 20, 6, 6, 1, 4], [5, 6, 12, 17]),
  crimson_arc: visual("slash_arc", "blood_ribbon", "red_crescent", "hand_near", 8, 0, [4, 25, -3, 25, 3, 4], [6, 7, 13, 19]),
  rift_uppercut: visual("rising_rift", "void_column", "vertical_tear", "chest", 14, -18, [5, 28, 5, 0, 2, 5], [6, 7, 14, 21]),
  bastion_break: visual("ground_break", "stone_chips", "stone_crack", "ground", 45, -2, [4, 30, -2, 15, 2, 5], [11, 12, 18, 25]),
  shadow_step: visual("afterimages", "shadow_echoes", "void_displacement", "pelvis", 0, -4, [3, 24, -5, 32, 3, 4], [4, 5, 10, 16]),
  ashen_sweep: visual("ground_arc", "flame_floor", "ember_spray", "ground", 42, -2, [4, 27, 2, 0, 1, 4], [6, 7, 13, 19]),
  glacier_spike: visual("vertical_shards", "frost_mist", "ice_pillars", "ground", 48, -3, [4, 30, -3, 4, 2, 4], [8, 9, 15, 22]),
  static_rush: visual("electric_afterimages", "ion_wake", "voltage_burst", "chest", 8, 2, [4, 20, 6, 18, 1, 4], [3, 4, 11, 17]),
  toxic_bloom: visual("poison_bloom", "spore_ring", "toxin_flower", "chest", 2, 3, [5, 26, -2, 45, 0, 5], [7, 8, 16, 23]),
  blood_moon: visual("blood_crescent", "red_droplets", "moon_slash", "hand_far", 10, -2, [4, 28, -4, 15, 3, 4], [9, 10, 16, 23]),
  void_hook: visual("void_tether", "tether_motes", "hook_snap", "hand_near", 7, 0, [3, 25, 3, 22, 1, 4], [7, 8, 14, 20]),
  iron_reversal: visual("reversal_flare", "iron_sparks", "iron_cross", "chest", 0, -7, [5, 22, -5, 0, 3, 5], [4, 5, 11, 17]),
  phoenix_drive: visual("rising_spiral", "phoenix_feathers", "fire_spiral", "chest", 12, -15, [5, 31, 5, 10, 2, 5], [7, 8, 15, 23]),
  permafrost: visual("frost_wave", "ground_rime", "frozen_surge", "ground", 50, -3, [4, 34, -2, 0, 2, 5], [9, 10, 18, 25]),
  plague_touch: visual("hand_aura", "lingering_cloud", "plague_mark", "hand_near", 3, 1, [4, 21, -2, 30, 0, 4], [5, 6, 12, 18]),
  thunder_clap: visual("shock_ring", "radial_arcs", "thunder_ring", "chest", 0, 0, [6, 27, 7, 0, 1, 5], [7, 8, 14, 21]),
  reaper_kick: visual("scythe_impact", "heel_crescent", "reaper_arc", "foot_near", 8, -2, [4, 30, -4, 18, 3, 5], [12, 13, 19, 27]),
  eclipse_breaker: visual("dark_crescent", "umbral_fall", "eclipse_wave", "hand_far", 12, 6, [5, 32, -3, 38, 3, 5], [10, 11, 18, 26]),
  prism_burst: visual("prism_star", "spectrum_rays", "prismatic_burst", "chest", 0, 1, [6, 34, 6, 0, 0, 6], [9, 10, 20, 28]),
  astral_jab: visual("astral_streak", "star_motes", "astral_point", "hand_near", 3, 0, [3, 15, 4, 8, 1, 3], [2, 3, 7, 11]),
  witch_knee: visual("knee_miasma", "witch_smoke", "poison_knot", "pelvis", 27, 1, [4, 20, -3, 33, 0, 4], [4, 5, 10, 15]),
  meteor_heel: visual("heel_descent", "falling_embers", "meteor_splash", "foot_near", 3, 3, [4, 24, 3, 50, 2, 4], [7, 8, 14, 20]),
  void_dive: visual("dive_wake", "split_afterimage", "void_crater", "pelvis", 18, 12, [4, 29, -4, 22, 3, 5], [8, 9, 16, 23]),
  grave_toll: visual("shock_ring", "bell_arcs", "resonant_burst", "chest", 0, 0, [6, 38, 5, 0, 1, 6], [10, 11, 18, 26]),
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
  poison: ["#b8ea63", "#65e6b1"],
  freeze: ["#78dcff", "#e0f8ff"],
  shock: ["#c68cff", "#fff06a"],
  bleed: ["#ff627f", "#ffb0bc"],
  void: ["#9478ff", "#67e4da"],
  physical: ["#f1d29a", "#ffffff"],
  prism: ["#ffffff", "#8fffe0"],
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
  if (["palm_burst", "shock_ring", "poison_bloom", "prism_star", "reversal_flare"].includes(effect)) {
    motif.appendChild(ring(0, 0, (effect === "poison_bloom" ? 21 : 14) * pulse, profile.secondary));
    const rays = effect === "prism_star" ? 8 : effect === "poison_bloom" ? 6 : 4;
    for (let i = 0; i < rays; i++) motif.appendChild(ray(0, 0, 8, 25 + (i % 2) * 7, i * (360 / rays), i % 2 ? profile.secondary : profile.primary));
  } else if (["slash_arc", "blood_crescent", "scythe_impact", "dark_crescent", "ground_arc", "frost_wave"].includes(effect)) {
    const low = effect === "ground_arc" || effect === "frost_wave";
    motif.appendChild(curve(low ? "M -28 7 Q 8 -4 48 4" : "M -28 18 Q 8 -34 48 -5", profile.primary, effect === "dark_crescent" ? 8 : 4));
    motif.appendChild(curve(low ? "M -20 12 Q 12 2 40 9" : "M -20 22 Q 10 -24 42 1", profile.secondary, 2));
  } else if (["vertical_shards", "heel_comet", "heel_descent"].includes(effect)) {
    const offsets = effect === "vertical_shards" ? [-18, 0, 18] : [0, 13, 25];
    for (const [i, offset] of offsets.entries()) motif.appendChild(shard(offset, effect === "vertical_shards" ? 7 - i * 8 : offset * 0.7, 7 + i * 2, 22 + i * 6, i % 2 ? profile.secondary : profile.primary, effect === "heel_descent" ? 32 : -8));
  } else if (["lightning_bolt", "electric_afterimages", "astral_streak"].includes(effect)) {
    motif.appendChild(polyline("-28,8 -12,-7 -2,3 12,-14 7,2 34,-9", profile.primary, effect === "lightning_bolt" ? 4 : 2));
    motif.appendChild(polyline("-22,15 -5,6 8,12 27,1", profile.secondary, 1.5));
  } else if (["rising_rift", "rising_spiral"].includes(effect)) {
    motif.appendChild(curve("M -12 28 C 25 12 -24 -10 12 -34", profile.primary, 5));
    motif.appendChild(curve("M 10 29 C -20 10 22 -12 -7 -40", profile.secondary, 2));
  } else if (["void_tether", "hand_aura"].includes(effect)) {
    motif.appendChild(curve(effect === "void_tether" ? "M -22 7 C 0 -20 27 22 54 -5" : "M -20 8 C -5 -20 18 -18 28 4", profile.primary, 3));
    motif.appendChild(ring(effect === "void_tether" ? 50 : 6, effect === "void_tether" ? -5 : 0, effect === "hand_aura" ? 20 * pulse : 8, profile.secondary));
  } else if (["afterimages", "dive_wake", "static_rush"].includes(effect)) {
    for (let i = 0; i < 3; i++) {
      const echo = document.createElementNS(SVG_NS, "ellipse");
      echo.setAttribute("cx", fmt(-i * 18)); echo.setAttribute("cy", fmt(i * 3));
      echo.setAttribute("rx", fmt(14 - i * 2)); echo.setAttribute("ry", fmt(29 - i * 4));
      echo.setAttribute("fill", "none"); echo.setAttribute("stroke", i % 2 ? profile.secondary : profile.primary);
      echo.setAttribute("opacity", fmt(0.7 - i * 0.2)); motif.appendChild(echo);
    }
  } else if (["fang_streak", "knuckle_flash", "low_streak"].includes(effect)) {
    const count = effect === "fang_streak" ? 3 : 2;
    for (let i = 0; i < count; i++) motif.appendChild(polyline(`${-26 - i * 4},${-7 + i * 7} ${32 + i * 5},${-2 + i * 4}`, i % 2 ? profile.secondary : profile.primary, effect === "fang_streak" ? 2 : 3));
  } else if (["ground_break", "knee_miasma"].includes(effect)) {
    if (effect === "ground_break") {
      motif.appendChild(polyline("-25,5 -10,-4 -2,8 12,-8 20,7 38,-2", profile.primary, 3));
      motif.appendChild(polyline("-2,8 2,25 12,10 24,22", profile.secondary, 2));
    } else {
      motif.appendChild(ring(-8, 4, 14 * pulse, profile.primary));
      motif.appendChild(ring(8, -5, 20 * pulse, profile.secondary));
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
  if (tags.includes("elemental")) return "prism";
  if (tags.includes("fire") || tags.includes("burn")) return "fire";
  if (tags.includes("chaos") || tags.includes("poison")) return "poison";
  if (tags.includes("cold") || tags.includes("freeze")) return "freeze";
  if (tags.includes("lightning") || tags.includes("shock")) return "shock";
  if (tags.includes("bleed")) return "bleed";
  if (tags.includes("void")) return "void";
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
