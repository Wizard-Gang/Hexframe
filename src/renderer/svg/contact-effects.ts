import type { ContactKindValue } from "../../combat/types";
import { fmt, SVG_NS, worldToScreen } from "./stage";

export const CONTACT_EFFECT_FRAMES = 10;

export type ContactEffectKind = "hit" | "block";

export interface ContactEffect {
  kind: ContactEffectKind;
  x: number;
  y: number;
  large: boolean;
  spawnedFrame: number;
}

export type ContactEffectSpawn = Omit<ContactEffect, "spawnedFrame">;

/** Presentation-only contact effects. Combat state never reads or mutates this queue. */
export class ContactEffectQueue {
  private effects: ContactEffect[] = [];

  spawn(effect: ContactEffectSpawn, frame: number): void {
    this.effects.push({ ...effect, spawnedFrame: frame });
  }

  active(frame: number): readonly ContactEffect[] {
    this.effects = this.effects.filter((effect) =>
      frame >= effect.spawnedFrame && frame - effect.spawnedFrame < CONTACT_EFFECT_FRAMES,
    );
    return this.effects;
  }

  clear(): void {
    this.effects.length = 0;
  }
}

export function effectKind(kind: ContactKindValue): ContactEffectKind {
  return kind === 1 ? "block" : "hit";
}

export function drawContactEffects(
  layer: SVGGElement,
  effects: readonly ContactEffect[],
  frame: number,
  reducedMotion: boolean,
): void {
  layer.replaceChildren();
  for (const effect of effects) {
    const point = worldToScreen(effect.x, effect.y);
    const age = Math.max(0, frame - effect.spawnedFrame);
    const size = effect.large ? 1.4 : 1;
    const animatedScale = reducedMotion ? size : size * (1 + age * 0.025);
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute(
      "class",
      [
        "contact-effect",
        effect.kind === "hit" ? "hit-spark" : "block-spark",
        effect.large ? "contact-effect-large" : "",
        reducedMotion ? "contact-effect-static" : "",
      ].filter(Boolean).join(" "),
    );
    group.setAttribute("data-effect", effect.kind === "hit" ? "hit-spark" : "block-spark");
    group.setAttribute("data-age", String(age));
    group.setAttribute(
      "transform",
      `translate(${fmt(point.x)} ${fmt(point.y)}) scale(${fmt(animatedScale)})`,
    );
    if (!reducedMotion) {
      group.setAttribute("opacity", fmt(Math.max(0.12, 1 - age / CONTACT_EFFECT_FRAMES)));
    }

    if (effect.kind === "block") drawBlockSpark(group, age, reducedMotion);
    else drawHitSpark(group, age, reducedMotion);
    layer.appendChild(group);
  }
}

function drawHitSpark(group: SVGGElement, age: number, reducedMotion: boolean): void {
  const core = document.createElementNS(SVG_NS, "circle");
  core.setAttribute("class", "hit-spark-core");
  core.setAttribute("r", reducedMotion ? "4" : fmt(Math.max(2.4, 4 - age * 0.12)));
  core.setAttribute("fill", "#fffdf4");
  group.appendChild(core);

  const ring = document.createElementNS(SVG_NS, "circle");
  ring.setAttribute("class", "hit-spark-ring");
  ring.setAttribute("r", fmt(reducedMotion ? 8 : 7 + age * 1.15));
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "#f1d29a");
  ring.setAttribute("stroke-width", "2");
  group.appendChild(ring);

  if (reducedMotion) return;
  for (let index = 0; index < 6; index++) {
    const inner = 7 + age * 0.3;
    const outer = 14 + age * 0.65 + (index % 2) * 3;
    const streak = document.createElementNS(SVG_NS, "line");
    streak.setAttribute("class", "hit-spark-streak");
    streak.setAttribute("x1", fmt(inner));
    streak.setAttribute("x2", fmt(outer));
    streak.setAttribute("stroke", index % 2 === 0 ? "#fffdf4" : "#f1d29a");
    streak.setAttribute("stroke-width", index % 2 === 0 ? "2" : "1.5");
    streak.setAttribute("stroke-linecap", "round");
    streak.setAttribute("transform", `rotate(${fmt(index * 60 + age * 3)})`);
    group.appendChild(streak);
  }
}

function drawBlockSpark(group: SVGGElement, age: number, reducedMotion: boolean): void {
  const core = document.createElementNS(SVG_NS, "circle");
  core.setAttribute("class", "block-spark-core");
  core.setAttribute("r", "3");
  core.setAttribute("fill", "#eef8ff");
  group.appendChild(core);

  const spread = reducedMotion ? 0 : age * 0.45;
  const arc = document.createElementNS(SVG_NS, "path");
  arc.setAttribute("class", "block-spark-arc");
  arc.setAttribute(
    "d",
    `M ${fmt(-11 - spread)} ${fmt(8 + spread * 0.3)} Q 0 ${fmt(-13 - spread)} ${fmt(11 + spread)} ${fmt(8 + spread * 0.3)}`,
  );
  arc.setAttribute("fill", "none");
  arc.setAttribute("stroke", "#cfe9f8");
  arc.setAttribute("stroke-width", "2.6");
  arc.setAttribute("stroke-linecap", "round");
  group.appendChild(arc);
}
