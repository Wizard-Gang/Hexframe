import { toPixels } from "../combat/constants";
import type { CharacterDef, MoveDef } from "../combat/types";
import { HitLevel, InvulKind } from "../combat/types";
import { STATUS_RULES } from "../content/status-rules";
import { deriveMoveFrameData, movePhase } from "./inspector";

export const MOVE_ROLES = ["starter", "link", "cashout"] as const;
export const MOVE_FAMILIES = ["fire", "freeze"] as const;
export type MoveRole = (typeof MOVE_ROLES)[number];
export type MoveFamily = (typeof MOVE_FAMILIES)[number];

const KIT_INPUTS = ["↑ / Y", "← / X", "→ / B", "↓ / A"] as const;

export function moveName(move: MoveDef): string {
  return move.key.replaceAll("_", " ");
}

export function primaryHitbox(move: MoveDef): MoveDef["hitboxes"][number] | undefined {
  return move.hitboxes[0];
}

export function primaryDamage(move: MoveDef): number {
  return primaryHitbox(move)?.damage ?? 0;
}

export function moveRole(move: MoveDef): MoveRole {
  return MOVE_ROLES.find((role) => move.tags.includes(role)) ?? "starter";
}

export function moveFamilies(move: MoveDef): MoveFamily[] {
  return MOVE_FAMILIES.filter((family) => move.tags.includes(family));
}

export function moveTerrain(move: MoveDef): "air" | "ground" {
  return move.airOk ? "air" : "ground";
}

export function moveLevel(move: MoveDef): "low" | "overhead" | "mid" {
  const level = primaryHitbox(move)?.level;
  if (level === HitLevel.Low) return "low";
  if (level === HitLevel.Overhead) return "overhead";
  return "mid";
}

function fixedInput(move: MoveDef, character: CharacterDef): string {
  const slot = character.commands.findIndex((command) => command.moveId === move.id);
  return KIT_INPUTS[slot] ?? "Engine fixture";
}

export function describeMoveFrame(move: MoveDef, frame: number, character?: CharacterDef): string {
  const hitboxes = move.hitboxes.filter((hitbox) => frame >= hitbox.startFrame && frame <= hitbox.endFrame);
  const cancels = move.cancelWindows.filter((window) => frame >= window.startFrame && frame <= window.endFrame);
  const invul = move.invulWindows.filter((window) => frame >= window.startFrame && frame <= window.endFrame);
  const armor = move.armorWindows.filter((window) => frame >= window.startFrame && frame <= window.endFrame);
  const movement = move.movement.filter((key) => key.frame === frame);
  const names = new Map(character?.moves.map((candidate) => [candidate.id, moveName(candidate)]) ?? []);
  const lines = [`FRAME ${String(frame + 1).padStart(2, "0")} · ${movePhase(move, frame)}`];
  if (hitboxes.length > 0) lines.push(...hitboxes.map((hitbox) =>
    `Hitbox: x ${toPixels(hitbox.box.x)}–${toPixels(hitbox.box.x + hitbox.box.w)}, y ${toPixels(hitbox.box.y)}–${toPixels(hitbox.box.y + hitbox.box.h)}`,
  ));
  else lines.push("Hitbox: none");
  if (cancels.length > 0) lines.push(`Cancel: ${cancels.flatMap((window) => window.into).map((id) => names.get(id) ?? `move ${id}`).join(", ")}`);
  else lines.push("Cancel: none");
  if (invul.length > 0) lines.push(`Invulnerability: ${invul.map((window) => invulName(window.kind)).join(", ")}`);
  if (armor.length > 0) lines.push(`Armor: ${Math.max(...armor.map((window) => window.hits))} hit`);
  if (movement.length > 0) lines.push(...movement.map((key) => `Movement: ${signed(toPixels(key.vx))} forward · ${signed(toPixels(key.vy))} vertical`));
  return lines.join("\n");
}

export function codexMoveDetailMarkup(move: MoveDef, character: CharacterDef): string {
  const hitbox = primaryHitbox(move);
  const frameData = deriveMoveFrameData(move);
  const role = moveRole(move);
  const families = moveFamilies(move);
  const cancelIds = [...new Set(move.cancelWindows.flatMap((window) => window.into))];
  const cancelsFrom = character.moves.filter((candidate) => candidate.cancelWindows.some((window) => window.into.includes(move.id)));
  const statuses = STATUS_RULES.filter((rule) => move.tags.includes(rule.tag));
  const movement = move.movement.length > 0
    ? move.movement.map((key) => `F${key.frame + 1}: ${signed(toPixels(key.vx))} forward / ${signed(toPixels(key.vy))} vertical`).join(" · ")
    : "None";
  const launch = hitbox && hitbox.launchVelocityY > 0 ? `${toPixels(hitbox.launchVelocityY)} upward` : "None";
  const armor = move.armorWindows.length > 0 ? move.armorWindows.map((window) => `${window.hits} hit · F${window.startFrame + 1}–${window.endFrame + 1}`).join(" · ") : "None";
  const invul = move.invulWindows.length > 0 ? move.invulWindows.map((window) => `${invulName(window.kind)} · F${window.startFrame + 1}–${window.endFrame + 1}`).join(" · ") : "None";

  return `<header class="codex-detail-heading"><div><p>${role.toUpperCase()} · ${(families.length > 0 ? families : ["PHYSICAL"]).join(" · ").toUpperCase()}</p><h2>${escapeHtml(moveName(move))}</h2><span>${escapeHtml(move.description)}</span></div><strong>${escapeHtml(fixedInput(move, character))}</strong></header>
    <div class="codex-detail-groups">
      ${detailGroup("IDENTITY", [
        ["Input", fixedInput(move, character)],
        ["Ground / air", move.airOk ? "Air" : move.requiresCrouch ? "Ground · crouching" : "Ground"],
        ["Attack level", moveLevel(move)],
        ["Stamina", String(move.staminaCost)],
        ["Tags", move.tags.join(" · ")],
      ])}
      ${detailGroup("FRAME DATA", [
        ["Startup", `${frameData.startup}f`], ["Active", `${frameData.active}f`], ["Recovery", `${frameData.recovery}f`], ["Total", `${move.duration}f`],
        ["Armor", armor], ["Invulnerability", invul], ["Movement", movement],
      ])}
      ${detailGroup("INTERACTION", [
        ["Damage", String(hitbox?.damage ?? 0)], ["Hitstun", `${hitbox?.hitstun ?? 0}f`], ["Blockstun", `${hitbox?.blockstun ?? 0}f`],
        ["Hitstop", `${hitbox?.hitstopAttacker ?? 0}f / ${hitbox?.hitstopDefender ?? 0}f`],
        ["Pushback", hitbox ? `${signed(toPixels(hitbox.pushbackHitAttacker))} / ${signed(toPixels(hitbox.pushbackHitDefender))}` : "None"],
        ["Launch", launch], ["Status", statuses.map((rule) => `${rule.name}: ${rule.primer}`).join(" · ") || "None"],
      ])}
      ${detailGroup("CANCELS", [
        ["Cancels into", cancelIds.map((id) => moveName(character.moves.find((candidate) => candidate.id === id) ?? move)).join(" · ") || "None"],
        ["Cancels from", cancelsFrom.map(moveName).join(" · ") || "None"],
      ])}
    </div>`;
}

function detailGroup(title: string, rows: readonly (readonly [string, string])[]): string {
  return `<section><h3>${title}</h3><dl>${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`;
}

function invulName(kind: number): string {
  if (kind === InvulKind.Full) return "Full";
  if (kind === InvulKind.Throw) return "Throw";
  return "Strike";
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
