/**
 * Hits, blocks, and everything that follows from one box touching another.
 *
 * This is the only place health, stun, hitstop and pushback are written, so "what does
 * this attack do" has exactly one answer and it is spelled out here rather than spread
 * across the states it affects.
 */

import type {
  CharacterDef,
  ContactEvent,
  FighterState,
  FrameReport,
  HitLevelValue,
  InputFrame,
  SimState,
} from "../types";
import { ContactKind, HitLevel, InputBit, InvulKind, StateId } from "../types";
import { NO_MOVE } from "../constants";
import { centerOf, intersection, overlaps } from "../collision/aabb";
import { activeHitboxesOf, armorRemaining, hurtboxesOf, isInvulnerable } from "../collision/boxes";
import {
  blockstunStateFor,
  enterState,
  hitstunStateFor,
  isCrouching,
  isInHitstun,
} from "../state/machine";

/**
 * Whether the defender is guarding this attack.
 *
 * Guarding is holding away from the attacker while free to do so. A fighter who is
 * attacking, in hitstun, in the air, in jump squat, landing, dashing or knocked down is
 * committed and cannot guard — blockstun itself is allowed, which is what makes a
 * blockstring hold together.
 *
 * The stance has to suit the level, and a stance that does not suit it is a hit rather
 * than a failed block: holding back against a low while standing is precisely the mistake
 * lows exist to punish. Left and right held together cancel under the shared horizontal-direction rule, so a
 * mashed stick guards nothing.
 *
 * On exactly equal x — two fighters somehow sharing an origin — "away" resolves to the
 * right. It is arbitrary and it is fixed, which is all determinism asks.
 */
export function isBlocking(
  defender: FighterState,
  defenderChar: CharacterDef,
  attacker: FighterState,
  input: InputFrame,
  level: HitLevelValue,
): boolean {
  if (defender.airborne === 1) return false;
  if (defender.state === StateId.Attack) return false;
  if (isInHitstun(defender)) return false;
  if (
    defender.state === StateId.JumpSquat ||
    defender.state === StateId.Landing ||
    defender.state === StateId.Knockdown
  ) {
    return false;
  }

  const left = (input & InputBit.Left) !== 0;
  const right = (input & InputBit.Right) !== 0;
  if (left === right) return false;
  const away = attacker.x > defender.x ? left : right;
  if (!away) return false;

  const crouching = isCrouching(defender);
  if (level === HitLevel.Low) return crouching;
  if (level === HitLevel.Overhead) return !crouching;
  return true;
}

/**
 * Test every live attack box against every opponent hurtbox, and apply what connects.
 *
 * A hitbox connects at most once with the opposing fighter during a move attempt.
 * `hitFlags` is both the per-hitbox contact gate and the on-hit-cancel signal.
 */
export function resolveContacts(
  state: SimState,
  chars: readonly CharacterDef[],
  inputs: readonly InputFrame[],
  report: FrameReport,
): void {
  for (let a = 0; a < state.fighters.length; a++) {
    const attacker = state.fighters[a];
    const attackerChar = chars[a];
    const attacks = activeHitboxesOf(attacker, attackerChar);
    if (attacks.length === 0) continue;

    for (let d = 0; d < state.fighters.length; d++) {
      if (d === a) continue;
      const defender = state.fighters[d];
      const defenderChar = chars[d];

      for (const { spec, aabb } of attacks) {
        // Ids are small integers assigned per move, so one bit each. Anything outside a
        // 31-bit mask is content that has outgrown this gate, and silently wrapping to
        // bit 0 would make two hitboxes share a "already hit" flag.
        if (spec.id < 0 || spec.id > 30) continue;
        const bit = 1 << spec.id;
        if ((attacker.hitFlags & bit) !== 0) continue;
        if (isInvulnerable(defender, defenderChar, InvulKind.Strike)) continue;

        let touched = null;
        let hurtboxId = -1;
        const hurtboxes = hurtboxesOf(defender, defenderChar);
        for (let hurtIndex = 0; hurtIndex < hurtboxes.length; hurtIndex++) {
          const hurt = hurtboxes[hurtIndex];
          if (overlaps(aabb, hurt)) {
            touched = hurt;
            hurtboxId = hurtIndex;
            break;
          }
        }
        if (touched === null) continue;

        attacker.hitFlags |= bit;
        const blocked = isBlocking(defender, defenderChar, attacker, inputs[d] ?? 0, spec.level);
        const overlap = intersection(aabb, touched) ?? aabb;
        const where = centerOf(overlap);
        const dir = attacker.facing;
        let dealtDamage = 0;
        let rawDamage = spec.damage;
        const counterHit = defender.state === StateId.Attack;
        const armored = !blocked && armorRemaining(defender, defenderChar) > 0;
        let appliedHitstun = spec.hitstun;

        attacker.hitstop = spec.hitstopAttacker;
        defender.hitstop = spec.hitstopDefender;

        if (blocked) {
          defender.stun = spec.blockstun;
          enterState(defender, blockstunStateFor(defender));
          attacker.vx = spec.pushbackBlockAttacker * dir * 2;
          defender.vx = spec.pushbackBlockDefender * dir;
          // Freeze the combatants for readability without pausing the simulation clock.
          attacker.hitstop = Math.max(attacker.hitstop, 4);
          defender.hitstop = Math.max(defender.hitstop, 4);
        } else {
          rawDamage = spec.damage;
          dealtDamage = rawDamage;
          defender.health = Math.max(0, defender.health - dealtDamage);
          defender.comboCount++;
          attacker.vx = spec.pushbackHitAttacker * dir;
          if (armored) {
            defender.armorHits++;
          } else {
            if (spec.launchVelocityY > 0) {
              defender.airborne = 1;
              defender.vy = spec.launchVelocityY;
            }
            const stunState = hitstunStateFor(defender);
            defender.stun = appliedHitstun;
            // Being hit ends whatever the defender was doing, including their own attack.
            defender.moveId = NO_MOVE;
            defender.moveFrame = 0;
            defender.hitFlags = 0;
            defender.armorHits = 0;
            enterState(defender, stunState);
            defender.vx = spec.pushbackHitDefender * dir;
          }
          if (defender.health === 0) {
            defender.stun = 0;
            defender.vx = 0;
            defender.vy = 0;
            enterState(defender, StateId.Defeat);
            state.roundOver = 1;
          }
        }

        const event: ContactEvent = {
          attacker: a,
          defender: d,
          moveId: attacker.moveId,
          hitboxId: spec.id,
          hurtboxId,
          kind: blocked ? ContactKind.Block : ContactKind.Hit,
          level: spec.level,
          damage: dealtDamage,
          rawDamage,
          hitstun: appliedHitstun,
          blockstun: spec.blockstun,
          hitstopAttacker: blocked ? Math.max(spec.hitstopAttacker, 4) : spec.hitstopAttacker,
          hitstopDefender: blocked ? Math.max(spec.hitstopDefender, 4) : spec.hitstopDefender,
          pushbackAttacker: blocked
            ? attacker.vx
            : spec.pushbackHitAttacker * dir,
          pushbackDefender: blocked
            ? spec.pushbackBlockDefender * dir
            : spec.pushbackHitDefender * dir,
          overlapWidth: overlap.x1 - overlap.x0,
          overlapHeight: overlap.y1 - overlap.y0,
          counterHit,
          armored,
          x: where.x,
          y: where.y,
        };
        report.contacts.push(event);
      }
    }
  }
}
