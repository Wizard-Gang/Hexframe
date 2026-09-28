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

import { SCALE, STAGE_HALF_WIDTH, toPixels } from "../../combat/index";
import type { StageDef } from "../../combat/types";

export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * A little air on each side of the playable width. The stage clamp stops a fighter's
 * origin at `±STAGE_HALF_WIDTH`, and their pushbox reaches further than their origin, so
 * a viewBox cut exactly at the clamp would slice a cornered fighter in half.
 */
const STAGE_MARGIN_PX = 20;

/** Half the visible width, world pixels. */
export const VIEW_HALF_WIDTH_PX = toPixels(STAGE_HALF_WIDTH) + STAGE_MARGIN_PX;

/**
 * Visible space above and below the ground line, world pixels. The test fighter is 104 px
 * tall and its jump apexes at 63 px, so 320 px of headroom leaves the fighters in the
 * lower third of the frame with room for a taller character later. The strip below the
 * ground exists so the floor reads as a surface rather than as the edge of the picture.
 */
export const VIEW_HEADROOM_PX = 320;
export const VIEW_FLOOR_PX = 80;

export const VIEW_WIDTH_PX = VIEW_HALF_WIDTH_PX * 2;
export const VIEW_HEIGHT_PX = VIEW_HEADROOM_PX + VIEW_FLOOR_PX;

export interface StageLayers {
  /** Sky, floor, wall markers. Static after `createStage`. */
  readonly background: SVGGElement;
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
  setCamera(playerX: number): void;
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

/**
 * Build the stage and attach it to `mount`.
 *
 * The camera is fixed for 0.1: the whole playable width is always on screen and nothing
 * tracks the fighters. `preserveAspectRatio="xMidYMid meet"` then does the entire job of
 * being responsive — the viewBox is in world pixels and the browser scales it to whatever
 * the container is, so no code here ever reads an element's size.
 */
export function createStage(mount: HTMLElement, stage?: StageDef): StageHandles {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute(
    "viewBox",
    `${fmt(-VIEW_HALF_WIDTH_PX)} ${fmt(-VIEW_HEADROOM_PX)} ${fmt(VIEW_WIDTH_PX)} ${fmt(VIEW_HEIGHT_PX)}`,
  );
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
  const fighters = group("sm-fighters");
  const effects = group("sm-effects");
  const debug = group("sm-debug");

  // Neither overlay is ever a click target; the lab puts its own controls over the stage.
  effects.style.pointerEvents = "none";
  debug.style.pointerEvents = "none";

  const halfW = stage ? toPixels(stage.width) / 2 + STAGE_MARGIN_PX : VIEW_HALF_WIDTH_PX;
  const stageWidth = halfW * 2;
  const wallX = stage ? toPixels(stage.width) / 2 : toPixels(STAGE_HALF_WIDTH);

  background.appendChild(rect(-halfW, -VIEW_HEADROOM_PX, stageWidth, VIEW_HEIGHT_PX, stage ? "#080a0f" : "#0d1117"));
  background.appendChild(rect(-halfW, 0, stageWidth, VIEW_FLOOR_PX, stage ? "#121219" : "#161b22"));

  // The centre line and the two walls are the only landmarks a fixed camera gives the
  // eye, and they are exactly the three x positions the simulation cares about.
  const centre = line(0, -VIEW_HEADROOM_PX, 0, VIEW_FLOOR_PX, "#21262d", 1);
  centre.setAttribute("stroke-dasharray", "4 8");
  background.appendChild(centre);

  for (const side of [-1, 1]) {
    const wall = line(wallX * side, -VIEW_HEADROOM_PX, wallX * side, VIEW_FLOOR_PX, "#30363d", 1);
    wall.setAttribute("stroke-dasharray", "6 6");
    background.appendChild(wall);
  }

  background.appendChild(line(-halfW, 0, halfW, 0, "#484f58", 2));

  world.appendChild(background);
  world.appendChild(fighters);
  world.appendChild(effects);
  world.appendChild(debug);
  svg.appendChild(world);
  mount.appendChild(svg);

  const setCamera = (playerX: number): void => {
    let center = toPixels(playerX);
    const viewHalf = VIEW_HALF_WIDTH_PX;
    const min = toPixels(stage?.cameraBounds.minX ?? -STAGE_HALF_WIDTH) + viewHalf;
    const max = toPixels(stage?.cameraBounds.maxX ?? STAGE_HALF_WIDTH) - viewHalf;
    center = min <= max ? Math.max(min, Math.min(max, center)) : 0;
    svg.setAttribute("viewBox", `${fmt(center - viewHalf)} ${fmt(-VIEW_HEADROOM_PX)} ${fmt(VIEW_WIDTH_PX)} ${fmt(VIEW_HEIGHT_PX)}`);
  };

  return { svg, world, layers: { background, fighters, effects, debug }, setCamera };
}
