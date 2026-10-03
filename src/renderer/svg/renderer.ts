import type { CharacterDef, FrameReport, SimState, StageDef } from "../../combat/types";
import { ContactKind, StateId } from "../../combat/types";
import { debugBoxes } from "../../combat/collision/boxes";
import type { RawAnimation, RawRig } from "../../content/raw-types";
import type { AnimationPlayback } from "../animation/animator";
import { animationForState, animationFrameForState, sampleAnimation } from "../animation/animator";
import { applyPose, boneAnchor, buildFighterNode } from "../character/rig";
import type { FighterNode } from "../character/rig";
import { drawHitboxes } from "./debug-overlay";
import { createStage, fmt, SVG_NS, worldToScreen } from "./stage";
import { drawMoveParticles, moveVisualDefinition, styleImpact } from "./move-effects";

export interface FighterRendererAssets {
  model: string;
  rig: RawRig;
  animations: Record<string, RawAnimation>;
  playback?: Readonly<Record<string, AnimationPlayback>>;
  presentationScale?: number;
}

export interface RendererAssets {
  fighters: readonly FighterRendererAssets[];
  stage?: StageDef;
}

export class Renderer {
  private readonly chars: readonly CharacterDef[];
  private readonly assets: readonly FighterRendererAssets[];
  private readonly stage;
  private readonly nodes: FighterNode[] = [];

  constructor(mount: HTMLElement, chars: readonly CharacterDef[], assets: RendererAssets) {
    this.chars = chars;
    this.assets = assets.fighters;
    this.stage = createStage(mount, assets.stage);

    for (let player = 0; player < chars.length; player++) {
      const asset = this.assets[player];
      if (!asset) throw new Error(`Renderer assets are missing player ${player}`);
      const node = buildFighterNode(asset.model, asset.rig);
      node.root.classList.add(`fighter-p${player + 1}`);
      this.stage.layers.fighters.appendChild(node.root);
      this.nodes.push(node);
    }
  }

  render(state: SimState, report: FrameReport | null, showHitboxes: boolean): void {
    const leadX = state.fighters[0]?.x ?? 0;
    const framed = state.fighters.filter((fighter) => fighter.health > 0 && Math.abs(fighter.x - leadX) <= 90_000);
    const focusX = framed.length > 0
      ? Math.trunc((Math.min(...framed.map((fighter) => fighter.x)) + Math.max(...framed.map((fighter) => fighter.x))) / 2)
      : leadX;
    this.stage.setCamera(focusX);
    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      const node = this.nodes[player];
      const asset = this.assets[player];
      const clipName = animationForState(fighter, this.chars[player]);
      const clip = asset.animations[clipName] ?? asset.animations["idle"];
      if (clip) {
        const frame = animationFrameForState(
          fighter,
          this.chars[player],
          clipName,
          clip,
          asset.playback?.[clipName],
        );
        applyPose(node, sampleAnimation(clip, frame));
      }
      const position = worldToScreen(fighter.x, fighter.y);
      const scale = asset.presentationScale ?? 1;
      node.root.setAttribute(
        "transform",
        `translate(${fmt(position.x)} ${fmt(position.y)}) scale(${fmt(fighter.facing * scale)} ${fmt(scale)})`,
      );
      node.root.classList.toggle("fighter-hitstop", fighter.hitstop > 0);
    }

    this.drawEffects(state, report);
    this.stage.svg.classList.toggle("stage-impact", (report?.contacts.length ?? 0) > 0);
    drawHitboxes(this.stage.layers.debug, debugBoxes(state, this.chars), showHitboxes);
  }

  dispose(): void {
    this.stage.svg.remove();
    this.nodes.length = 0;
  }

  private drawEffects(state: SimState, report: FrameReport | null): void {
    this.stage.layers.effects.replaceChildren();
    for (let player = 0; player < state.fighters.length; player++) {
      const fighter = state.fighters[player];
      if (fighter.state !== StateId.Attack) continue;
      const move = this.chars[player].moves.find((candidate) => candidate.id === fighter.moveId);
      if (!move) continue;
      const asset = this.assets[player];
      const point = worldToScreen(fighter.x, fighter.y);
      const anchor = this.effectAnchor(player, move);
      const scale = asset.presentationScale ?? 1;
      const anchored = {
        x: point.x + fighter.facing * anchor.x * scale,
        y: point.y + anchor.y * scale,
      };
      drawMoveParticles(this.stage.layers.effects, move, anchored.x, anchored.y, fighter.facing, fighter.moveFrame, scale);
    }
    if (!report) return;
    for (const contact of report.contacts) {
      const point = worldToScreen(contact.x, contact.y);
      const burst = document.createElementNS(SVG_NS, "g");
      const move = this.chars[contact.attacker].moves.find((candidate) => candidate.id === contact.moveId);
      const profile = move ? styleImpact(burst, move) : null;
      if (!move) burst.setAttribute("class", "contact-burst effect-physical");
      if (contact.kind === ContactKind.Block) {
        burst.setAttribute("class", "contact-burst block-burst");
      }
      burst.setAttribute("transform", `translate(${fmt(point.x)} ${fmt(point.y)})`);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", fmt(profile ? 7 + profile.radius * 0.15 : 9));
      circle.setAttribute("class", "contact-ring");
      if (contact.kind === ContactKind.Block) circle.setAttribute("stroke", "#92a1ad");
      else if (profile) circle.setAttribute("stroke", profile.secondary);
      burst.appendChild(circle);
      const rays = profile?.count ?? 4;
      for (let ray = 0; ray < rays; ray++) {
        const line = document.createElementNS(SVG_NS, "line");
        const length = 12 + (profile ? Math.trunc(profile.radius * .35) : 0) + (ray % 3) * 3;
        line.setAttribute("x1", fmt(-length));
        line.setAttribute("x2", fmt(length));
        line.setAttribute("class", "contact-ray");
        if (contact.kind === ContactKind.Block) line.setAttribute("stroke", ray % 2 === 0 ? "#62717e" : "#c2ccd3");
        else if (profile) line.setAttribute("stroke", ray % 2 === 0 ? profile.primary : profile.secondary);
        line.setAttribute("transform", `rotate(${fmt((profile?.rotation ?? 0) + ray * (180 / rays))})`);
        burst.appendChild(line);
      }
      if (contact.damage > 0) {
        const damage = document.createElementNS(SVG_NS, "text");
        damage.setAttribute("class", "damage-number");
        damage.setAttribute("y", "-18");
        damage.setAttribute("text-anchor", "middle");
        damage.textContent = String(contact.damage);
        burst.appendChild(damage);
      }
      this.stage.layers.effects.appendChild(burst);
    }
  }

  private effectAnchor(player: number, move: CharacterDef["moves"][number]): { x: number; y: number } {
    const visual = moveVisualDefinition(move.key);
    if (visual.anchor === "ground") return { x: 0, y: 0 };
    if (visual.anchor === "hitbox_center") {
      const hitbox = move.hitboxes[0];
      return hitbox ? { x: (hitbox.box.x + hitbox.box.w / 2) / 100, y: -(hitbox.box.y + hitbox.box.h / 2) / 100 } : { x: 0, y: -48 };
    }
    const bone = {
      hand_near: "hand_r", hand_far: "hand_l", foot_near: "foot_r", foot_far: "foot_l",
      head: "head", chest: "torso", pelvis: "pelvis",
    }[visual.anchor];
    const point = boneAnchor(this.nodes[player], bone);
    if (visual.anchor === "chest") point.y -= 28;
    if (visual.anchor === "head") point.y -= 10;
    return point;
  }

}
