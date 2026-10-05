import { SVG_NS, fmt, worldToScreen } from "./stage";

export const LANDING_DUST_FRAMES = 7;
export const IMPACT_SHAKE_FRAMES = 4;

export interface LandingDustEffect {
  readonly player: number;
  readonly x: number;
  readonly y: number;
  readonly spawnedFrame: number;
}

interface ImpactShakeEffect {
  readonly spawnedFrame: number;
}

export interface ShakeOffset {
  readonly x: number;
  readonly y: number;
}

export class StageMotionEffectQueue {
  private dust: LandingDustEffect[] = [];
  private shakes: ImpactShakeEffect[] = [];
  private readonly lastLandingFrame = new Map<number, number>();

  observeLanding(player: number, x: number, y: number, frame: number, enabled: boolean): boolean {
    if (this.lastLandingFrame.get(player) === frame) return false;
    this.lastLandingFrame.set(player, frame);
    if (!enabled) return false;
    this.dust.push({ player, x, y, spawnedFrame: frame });
    return true;
  }

  spawnImpact(frame: number): void {
    this.shakes.push({ spawnedFrame: frame });
  }

  activeDust(frame: number): readonly LandingDustEffect[] {
    this.dust = this.dust.filter((effect) => {
      const age = frame - effect.spawnedFrame;
      return age >= 0 && age < LANDING_DUST_FRAMES;
    });
    return this.dust;
  }

  shakeOffset(frame: number): ShakeOffset {
    this.shakes = this.shakes.filter((effect) => {
      const age = frame - effect.spawnedFrame;
      return age >= 0 && age < IMPACT_SHAKE_FRAMES;
    });
    const newest = this.shakes.at(-1);
    return newest ? impactShakeOffset(frame - newest.spawnedFrame) : { x: 0, y: 0 };
  }

  clearAnimated(): void {
    this.dust.length = 0;
    this.shakes.length = 0;
  }

  clear(): void {
    this.clearAnimated();
    this.lastLandingFrame.clear();
  }
}

export function impactShakeOffset(age: number): ShakeOffset {
  const offsets: readonly ShakeOffset[] = [
    { x: 3, y: -1 },
    { x: -2, y: 1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];
  return offsets[age] ?? { x: 0, y: 0 };
}

export function drawLandingDust(
  layer: SVGGElement,
  effects: readonly LandingDustEffect[],
  frame: number,
  reducedMotion: boolean,
): void {
  layer.replaceChildren();
  if (reducedMotion) return;

  for (const effect of effects) {
    const age = Math.max(0, frame - effect.spawnedFrame);
    const point = worldToScreen(effect.x, effect.y);
    const fade = Math.max(0, 1 - age / LANDING_DUST_FRAMES);
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `landing-dust fighter-p${effect.player + 1}`);
    group.setAttribute("data-effect", "landing-dust");
    group.setAttribute("data-age", String(age));
    group.setAttribute("transform", `translate(${fmt(point.x)} ${fmt(point.y)})`);

    for (let index = 0; index < 4; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const outer = index >= 2 ? 1 : 0;
      const puff = document.createElementNS(SVG_NS, "ellipse");
      puff.setAttribute("class", "landing-dust__puff");
      puff.setAttribute("cx", fmt(side * (5 + outer * 5 + age * (1.2 + outer * 0.35))));
      puff.setAttribute("cy", fmt(-1.5 - outer * 1.5 - age * 0.18));
      puff.setAttribute("rx", fmt(3.4 + outer + age * 0.8));
      puff.setAttribute("ry", fmt(1.6 + outer * 0.35 + age * 0.22));
      puff.setAttribute("fill", outer ? "#7d766a" : "#a79d8b");
      puff.setAttribute("opacity", fmt(fade * (outer ? 0.45 : 0.62)));
      group.appendChild(puff);
    }

    layer.appendChild(group);
  }
}

export function applyStageShake(world: SVGGElement, offset: ShakeOffset, reducedMotion: boolean): void {
  if (reducedMotion || (offset.x === 0 && offset.y === 0)) {
    world.removeAttribute("transform");
    return;
  }
  world.setAttribute("transform", `translate(${fmt(offset.x)} ${fmt(offset.y)})`);
}
