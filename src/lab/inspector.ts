import { toPixels } from "../combat/constants";
import type {
  CharacterDef,
  ContactEvent,
  FighterState,
  FrameReport,
  MoveDef,
  SimState,
  StateIdValue,
} from "../combat/types";
import { ContactKind, HitLevel, StateId } from "../combat/types";
import { hashToHex } from "../rollback/hashing/fnv";

const STATE_NAMES = new Map<number, string>(
  Object.entries(StateId).map(([name, value]) => [value, name.replace(/([a-z])([A-Z])/g, "$1 $2")]),
);

export type MovePhase = "STARTUP" | "ACTIVE" | "RECOVERY" | "COMPLETE";

export interface MoveFrameData {
  startup: number;
  active: number;
  recovery: number;
  firstActive: number;
  lastActive: number;
  activeFrames: ReadonlySet<number>;
}

export interface InteractionSelection {
  frame: number;
  index: number;
}

/** Derive the visible frame data from authoritative hitbox events, not parallel labels. */
export function deriveMoveFrameData(move: MoveDef): MoveFrameData {
  const activeFrames = new Set<number>();
  for (const hitbox of move.hitboxes) {
    for (let frame = hitbox.startFrame; frame <= hitbox.endFrame; frame++) activeFrames.add(frame);
  }
  const ordered = [...activeFrames].sort((a, b) => a - b);
  const firstActive = ordered[0] ?? move.duration;
  const lastActive = ordered[ordered.length - 1] ?? firstActive - 1;
  return {
    startup: firstActive,
    active: activeFrames.size,
    recovery: Math.max(0, move.duration - lastActive - 1),
    firstActive,
    lastActive,
    activeFrames,
  };
}

export function movePhase(move: MoveDef | null, frame: number): MovePhase {
  if (!move || frame < 0 || frame >= move.duration) return "COMPLETE";
  const data = deriveMoveFrameData(move);
  if (frame < data.firstActive) return "STARTUP";
  if (data.activeFrames.has(frame)) return "ACTIVE";
  return "RECOVERY";
}

/** The frame-centric state cards shown beside the stage. */
export function frameInspectorMarkup(
  state: SimState,
  characters: readonly CharacterDef[],
  report: FrameReport | null,
  hash: number,
): string {
  const fighters = state.fighters.map((fighter, player) => fighterMarkup(fighter, characters[player], player));
  const contact = report?.contacts[0];
  const eventLine = contact
    ? `CONTACT ${String(report.frame).padStart(6, "0")} · ${contact.kind === ContactKind.Hit ? "HIT" : "BLOCK"} · P${contact.attacker + 1} → P${contact.defender + 1}`
    : "NO CONTACT ON DISPLAYED STATE";
  return `<header><span>AUTHORITATIVE STATE</span><code>${hashToHex(hash)}</code></header>
    <div class="inspector-frame"><span>STATE FRAME</span><strong>${String(state.frame).padStart(6, "0")}</strong><em>${eventLine}</em></div>
    <div class="fighter-inspector-grid">${fighters.join("")}</div>`;
}

function fighterMarkup(fighter: FighterState, character: CharacterDef, player: number): string {
  const move = character.moves.find((candidate) => candidate.id === fighter.moveId) ?? null;
  const phase = move ? movePhase(move, fighter.moveFrame) : "COMPLETE";
  return `<article class="fighter-inspector">
    <h3><span>${player === 0 ? "P1" : "DUMMY"}</span>${escapeHtml(character.name)}</h3>
    <dl>
      ${datum("STATE", `${stateName(fighter.state)} · ${fighter.stateFrame}f`)}
      ${datum("MOVE", move ? escapeHtml(move.key) : "—")}
      ${datum("MOVE FRAME", move ? `${String(fighter.moveFrame + 1).padStart(2, "0")} / ${String(move.duration).padStart(2, "0")}` : "—")}
      ${datum("PHASE", move ? phase : "NEUTRAL", phase.toLowerCase())}
      ${datum("POSITION", `${toPixels(fighter.x)}, ${toPixels(fighter.y)}`)}
      ${datum("VELOCITY", `${toPixels(fighter.vx)}, ${toPixels(fighter.vy)}`)}
      ${datum("FACING", fighter.facing === 1 ? "RIGHT" : "LEFT")}
      ${datum("HITSTOP", `${fighter.hitstop}f`)}
      ${datum("STUN", `${fighter.stun}f`)}
      ${datum("STAMINA", `${fighter.stamina} / ${character.stamina}`)}
      ${datum("ARMOR HITS", String(fighter.armorHits))}
    </dl>
  </article>`;
}

/** A discrete authored move timeline. Visual pose never decides any collision row. */
export function moveTimelineMarkup(move: MoveDef): string {
  const data = deriveMoveFrameData(move);
  const frames = Array.from({ length: move.duration }, (_, frame) => frame);
  const phaseCells = frames.map((frame) => cell(frame, phaseClass(move, frame))).join("");
  const fullCells = frames.map((frame) => cell(frame, "on")).join("");
  const hitCells = frames.map((frame) => cell(frame, data.activeFrames.has(frame) ? "on hit" : "")).join("");
  const cancelCells = frames.map((frame) => cell(frame, inWindow(move.cancelWindows, frame) ? "on cancel" : "")).join("");
  const invulCells = frames.map((frame) => cell(frame, inWindow(move.invulWindows, frame) ? "on invul" : "")).join("");
  const armorCells = frames.map((frame) => cell(frame, inWindow(move.armorWindows, frame) ? "on armor" : "")).join("");
  const numberCells = frames.map((frame) => `<span class="timeline-cell frame-number" data-frame="${frame}">${frame + 1}</span>`).join("");

  return `<header class="move-timeline-header"><div><p>MOVE TIMELINE / EVENT-DERIVED</p><h2>${escapeHtml(move.key)}</h2></div><dl><div><dt>STARTUP</dt><dd>${data.startup}f</dd></div><div><dt>ACTIVE</dt><dd>${data.active}f</dd></div><div><dt>RECOVERY</dt><dd>${data.recovery}f</dd></div><div><dt>TOTAL</dt><dd>${move.duration}f</dd></div></dl></header>
    <div class="move-timeline-scroll"><div class="move-timeline" data-move-frames="${move.duration}">
      ${timelineRow("FRAME", numberCells)}
      ${timelineRow("PHASE", phaseCells)}
      ${timelineRow("POSE", fullCells)}
      ${timelineRow("HIT", hitCells)}
      ${timelineRow("HURT", fullCells)}
      ${timelineRow("MOVE", fullCells)}
      ${timelineRow("CANCEL", cancelCells)}
      ${timelineRow("INVUL", invulCells)}
      ${timelineRow("ARMOR", armorCells)}
    </div></div>`;
}

/** Collision history and a detailed resolution record for one selected event. */
export function interactionHistoryMarkup(
  reports: readonly FrameReport[],
  characters: readonly CharacterDef[],
  requested: InteractionSelection | null,
): string {
  const events = reports.flatMap((report) => report.contacts.map((contact, index) => ({ report, contact, index })));
  const selected = requested
    ? events.find((event) => event.report.frame === requested.frame && event.index === requested.index)
    : events[events.length - 1];
  const list = events.length === 0
    ? `<p class="interaction-empty">No attack volume has touched a hurtbox in this run.</p>`
    : events.slice(-16).reverse().map(({ report, contact, index }) => {
        const move = characters[contact.attacker]?.moves.find((candidate) => candidate.id === contact.moveId);
        const active = selected?.report.frame === report.frame && selected.index === index;
        return `<button type="button" class="interaction-event${active ? " selected" : ""}" data-gamepad-nav data-contact-frame="${report.frame}" data-contact-index="${index}" aria-pressed="${active}"><span>FRAME ${String(report.frame).padStart(6, "0")}</span><strong>${contact.kind === ContactKind.Hit ? "HIT" : "BLOCK"}</strong><em>${escapeHtml(move?.key ?? `move_${contact.moveId}`)}</em></button>`;
      }).join("");

  return `<div class="interaction-list" aria-label="Collision event history">${list}</div>
    <article class="interaction-detail">${selected ? contactDetail(selected.report.frame, selected.contact, characters) : `<p>Select a recorded collision to inspect its resolution.</p>`}</article>`;
}

function contactDetail(frame: number, contact: ContactEvent, characters: readonly CharacterDef[]): string {
  const attacker = characters[contact.attacker];
  const defender = characters[contact.defender];
  const move = attacker?.moves.find((candidate) => candidate.id === contact.moveId);
  const result = contact.kind === ContactKind.Hit ? contact.armored ? "ARMORED HIT" : "HIT" : "BLOCK";
  return `<header><div><p>INTERACTION INSPECTOR</p><h2>FRAME ${String(frame).padStart(6, "0")}</h2></div><strong>${result}</strong></header>
    <div class="interaction-columns">
      <section><h3>ATTACKER</h3><dl>${datum("FIGHTER", attacker?.name ?? `P${contact.attacker + 1}`)}${datum("MOVE", move?.key ?? String(contact.moveId))}${datum("HITBOX", `attack_${contact.hitboxId}`)}${datum("LEVEL", levelName(contact.level))}</dl></section>
      <section><h3>DEFENDER</h3><dl>${datum("FIGHTER", defender?.name ?? `P${contact.defender + 1}`)}${datum("HURTBOX", `hurt_${contact.hurtboxId}`)}${datum("COUNTER HIT", contact.counterHit ? "TRUE" : "FALSE")}${datum("HYPER ARMOR", contact.armored ? "ABSORBED" : "NO")}${datum("CONTACT", `${toPixels(contact.x)}, ${toPixels(contact.y)}`)}</dl></section>
      <section><h3>COLLISION</h3><dl>${datum("AABB OVERLAP", `${toPixels(contact.overlapWidth)} × ${toPixels(contact.overlapHeight)}`)}${datum("RESULT", result, result.toLowerCase())}${datum("RAW DAMAGE", String(contact.rawDamage))}${datum("DAMAGE", String(contact.damage))}</dl></section>
      <section><h3>RESOLUTION</h3><dl>${datum("HITSTUN", `${contact.hitstun}f`)}${datum("BLOCKSTUN", `${contact.blockstun}f`)}${datum("HITSTOP", `${contact.hitstopAttacker}f / ${contact.hitstopDefender}f`)}${datum("PUSHBACK", `${toPixels(contact.pushbackAttacker)} / ${toPixels(contact.pushbackDefender)}`)}</dl></section>
    </div>`;
}

function timelineRow(label: string, cells: string): string {
  return `<div class="timeline-row"><strong>${label}</strong><div>${cells}</div></div>`;
}

function cell(frame: number, className: string): string {
  return `<span class="timeline-cell ${className}" data-frame="${frame}"></span>`;
}

function inWindow(windows: readonly { startFrame: number; endFrame: number }[], frame: number): boolean {
  return windows.some((window) => frame >= window.startFrame && frame <= window.endFrame);
}

function phaseClass(move: MoveDef, frame: number): string {
  return `on phase-${movePhase(move, frame).toLowerCase()}`;
}

function stateName(state: StateIdValue): string {
  return (STATE_NAMES.get(state) ?? String(state)).toUpperCase();
}

function levelName(level: number): string {
  if (level === HitLevel.Low) return "LOW";
  if (level === HitLevel.Overhead) return "OVERHEAD";
  return "MID";
}

function datum(label: string, value: string, className = ""): string {
  return `<div${className ? ` class="${className}"` : ""}><dt>${label}</dt><dd>${value}</dd></div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
