/**
 * The stage: the one place in the project where simulation space becomes screen space.
 *
 * The simulation puts x at 0 in the middle of the stage and grows it to the right, puts y
 * at 0 on the ground and grows it *up*, and measures both in sim units (`SCALE` per world
 * pixel). SVG grows y down. Rather than sprinkling sign flips through the renderer, the
 * viewBox is chosen so that the world origin lands exactly on the SVG origin, which makes
 * `worldToScreen` a divide and a negate and makes the world group need no transform at
 * all. Everything downstream — fighters, effects, the debug overlay — goes through this
 * function, so there is precisely one definition of where a world point appears.
 */

import { SCALE, px, toPixels } from "../../combat/index";
import type { StageDef } from "../../combat/types";

export const SVG_NS = "http://www.w3.org/2000/svg";

/** Shared combat dimensions; presentation never changes the arena bounds. */
export const TRAINING_STAGE: StageDef = {
  id: "training",
  width: px(960),
  cameraBounds: { minX: px(-480), maxX: px(480) },
};

export function cameraFrame(points: readonly { x: number; y: number }[], aspect: number) {
  const xs = points.map((point) => toPixels(point.x));
  const min = xs.length ? Math.min(...xs) : 0;
  const max = xs.length ? Math.max(...xs) : 0;
  const headroom = Math.max(210, ...points.map((point) => toPixels(point.y) + 160));
  const height = Math.max(headroom + 65, (max - min + 160) / aspect, 440 / aspect);
  const width = height * aspect;
  return { x: (min + max - width) / 2, y: -height + 65, width, height };
}

export interface StageLayers {
  /** Gradient, floor and horizon, sized to the current view. */
  readonly background: SVGGElement;
  /** Landing dust, drawn behind the fighters. */
  readonly groundEffects: SVGGElement;
  /** Foot projections onto the floor. */
  readonly shadows: SVGGElement;
  /** Short presentation-only arcs left by active striking limbs. */
  readonly trails: SVGGElement;
  /** One posed fighter rig per player. */
  readonly fighters: SVGGElement;
  /** Contact sparks and anything else driven by `FrameReport`. */
  readonly effects: SVGGElement;
  /** The debug overlay. Empty unless a toggle is on. */
  readonly debug: SVGGElement;
}

export interface StageHandles {
  readonly svg: SVGSVGElement;
  /** Parent of every layer. World coordinates, no transform: see the note above. */
  readonly world: SVGGElement;
  readonly layers: StageLayers;
  setCamera(points: readonly { x: number; y: number }[]): void;
}

/** Sim units to screen units, and the only y flip in the renderer. */
export function worldToScreen(x: number, y: number): { x: number; y: number } {
  return { x: x / SCALE, y: -y / SCALE };
}

/**
 * A length in sim units as a screen length. Lengths do not flip — only positions do —
 * which is why this is separate from `worldToScreen` rather than a call to it.
 */
export function screenLength(simUnits: number): number {
  return simUnits / SCALE;
}

/** Short, stable numbers for transform and geometry attributes. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function group(id: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("id", id);
  return g;
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number): SVGLineElement {
  const el = document.createElementNS(SVG_NS, "line");
  el.setAttribute("x1", fmt(x1));
  el.setAttribute("y1", fmt(y1));
  el.setAttribute("x2", fmt(x2));
  el.setAttribute("y2", fmt(y2));
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", fmt(width));
  return el;
}

function rect(x: number, y: number, w: number, h: number, fill: string): SVGRectElement {
  const el = document.createElementNS(SVG_NS, "rect");
  el.setAttribute("x", fmt(x));
  el.setAttribute("y", fmt(y));
  el.setAttribute("width", fmt(w));
  el.setAttribute("height", fmt(h));
  el.setAttribute("fill", fill);
  return el;
}

/** Build a responsive arena; camera coordinates stay in presentation pixels. */
export function createStage(mount: HTMLElement): StageHandles {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Match stage");
  svg.style.display = "block";
  svg.style.width = "100%";
  svg.style.height = "100%";

  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = "Match stage";
  svg.appendChild(title);

  const world = group("sm-world");

  const background = group("sm-background");
  const shadows = group("sm-shadows");
  const groundEffects = group("sm-ground-effects");
  const trails = group("sm-trails");
  const fighters = group("sm-fighters");
  const effects = group("sm-effects");
  const debug = group("sm-debug");

  // Presentation overlays are never click targets; the lab owns interaction above the stage.
  groundEffects.style.pointerEvents = "none";
  trails.style.pointerEvents = "none";
  effects.style.pointerEvents = "none";
  debug.style.pointerEvents = "none";

  const defs = document.createElementNS(SVG_NS, "defs");
  // Per-SVG IDs also keep the overview and Training independent.
  const gradientId = `arena-gradient-${document.querySelectorAll("svg").length}`;
  const gradient = document.createElementNS(SVG_NS, "linearGradient");
  gradient.id = gradientId;
  gradient.setAttribute("x2", "0");
  gradient.setAttribute("y2", "1");
  for (const [offset, color] of [["0%", "#0b111b"], ["100%", "#242b35"]] as const) {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  svg.appendChild(defs);
  const sky = rect(0, 0, 1, 1, `url(#${gradientId})`);
  const floor = rect(0, 0, 1, 1, "#141b23");
  const horizon = line(0, 0, 1, 0, "#46515e", 1);
  for (const surface of [sky, floor, horizon]) background.appendChild(surface);

  world.appendChild(background);
  world.appendChild(shadows);
  world.appendChild(groundEffects);
  world.appendChild(trails);
  world.appendChild(fighters);
  world.appendChild(effects);
  world.appendChild(debug);
  svg.appendChild(world);
  mount.appendChild(svg);

  const setCamera = (points: readonly { x: number; y: number }[]): void => {
    const bounds = mount.getBoundingClientRect();
    const aspect = bounds.width > 0 && bounds.height > 0 ? bounds.width / bounds.height : 16 / 9;
    const frame = cameraFrame(points, aspect);
    svg.setAttribute("viewBox", `${fmt(frame.x)} ${fmt(frame.y)} ${fmt(frame.width)} ${fmt(frame.height)}`);
    for (const surface of [sky, floor]) {
      surface.setAttribute("x", fmt(frame.x));
      surface.setAttribute("width", fmt(frame.width));
    }
    sky.setAttribute("y", fmt(frame.y));
    sky.setAttribute("height", fmt(frame.height));
    floor.setAttribute("height", "65");
    horizon.setAttribute("x1", fmt(frame.x));
    horizon.setAttribute("x2", fmt(frame.x + frame.width));
  };
  setCamera([]);
  return { svg, world, layers: { background, shadows, groundEffects, trails, fighters, effects, debug }, setCamera };
}
