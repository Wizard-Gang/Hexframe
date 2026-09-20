import type { CharacterDef, FrameReport, SimState, StateIdValue } from "../../combat/types";
import { ContactKind, StateId } from "../../combat/types";
import { toPixels } from "../../combat/constants";
import { hashToHex } from "../../rollback/hashing/fnv";
import { replaceTrustedMarkup } from "../../client/trusted-markup";

const STATE_NAMES = new Map<number, string>(
  Object.entries(StateId).map(([name, value]) => [value, name]),
);

function stateName(state: StateIdValue): string {
  return STATE_NAMES.get(state) ?? String(state);
}

/** Compact live state inspector. Controls live in the lab app; this class only reports. */
export class DebugPanel {
  private readonly mount: HTMLElement;

  constructor(mount: HTMLElement) {
    this.mount = mount;
  }

  update(
    state: SimState,
    chars: readonly CharacterDef[],
    report: FrameReport | null,
    hash: number,
  ): void {
    const fighterCards = state.fighters.map((fighter, player) => {
      const character = chars[player];
      const move = character.moves.find((candidate) => candidate.id === fighter.moveId);
      return `<article class="debug-fighter">
        <header><span>P${player + 1}</span><strong>${character.name}</strong></header>
        <dl>
          <div><dt>state</dt><dd>${stateName(fighter.state)} · ${fighter.stateFrame}</dd></div>
          <div><dt>position</dt><dd>${toPixels(fighter.x)}, ${toPixels(fighter.y)}</dd></div>
          <div><dt>velocity</dt><dd>${toPixels(fighter.vx)}, ${toPixels(fighter.vy)}</dd></div>
          <div><dt>move</dt><dd>${move?.key ?? "—"}${move ? ` · ${fighter.moveFrame}` : ""}</dd></div>
          <div><dt>timers</dt><dd>stop ${fighter.hitstop} · stun ${fighter.stun}</dd></div>
          <div><dt>health</dt><dd>${fighter.health} / ${character.health}</dd></div>
          <div><dt>stamina</dt><dd>${fighter.stamina} / ${character.stamina} · regen ${fighter.staminaRegenDelay}</dd></div>
          <div><dt>armor</dt><dd>${fighter.armorHits} hit(s) absorbed</dd></div>
          <div><dt>status</dt><dd>burn ${fighter.burnStacks} · poison ${fighter.poisonStacks} · freeze ${fighter.freezeStacks} · shock ${fighter.shockStacks} · bleed ${fighter.bleedStacks}</dd></div>
        </dl>
      </article>`;
    });

    const contacts = report?.contacts.length
      ? report.contacts
          .map(
            (contact) =>
              `P${contact.attacker + 1} → P${contact.defender + 1} · ${
                contact.kind === ContactKind.Hit ? contact.armored ? "ARMORED HIT" : "HIT" : "BLOCK"
              } · ${contact.damage}`,
          )
          .join("<br>")
      : "No contact this frame";

    replaceTrustedMarkup(this.mount, `<div class="debug-summary">
      <span>frame <strong>${state.frame}</strong></span>
      <span>hash <code>${hashToHex(hash)}</code></span>
      <span>entities <strong>${state.entities.length}</strong></span>
    </div>
    <div class="debug-fighters">${fighterCards.join("")}</div>
    <p class="debug-contact">${contacts}</p>`);
  }
}
