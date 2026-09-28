import { DebuffKind } from "../combat/types";

export interface StatusRule {
  tag: "burn" | "freeze";
  name: string;
  glyph: string;
  debuff: (typeof DebuffKind)[keyof typeof DebuffKind];
  primer: string;
  payoff: string;
  maxStacks: number;
}

export const STATUS_RULES: readonly StatusRule[] = [
  { tag: "burn", name: "Burn", glyph: "B", debuff: DebuffKind.Burn, primer: "Deals damage over time for 1.5 seconds and stacks three times.", payoff: "Another burn move scorches for +4 damage per active stack, then refreshes it.", maxStacks: 3 },
  { tag: "freeze", name: "Freeze", glyph: "F", debuff: DebuffKind.Freeze, primer: "One stack chills movement, two stacks slow it further, three stacks freeze for 0.4 seconds.", payoff: "Freeze-tagged follow-ups gain +3 damage per cold stack and refresh the setup.", maxStacks: 3 },
];

export function statusRuleFor(tag: string): StatusRule | null {
  return STATUS_RULES.find((rule) => rule.tag === tag) ?? null;
}
