import type { GameSession } from "../game/session";
import { replaceTrustedMarkup } from "./trusted-markup";

/**
 * Campaign pause is a checkpoint menu, not a second copy of the Loadouts application.
 * Keep the existing tab/focus contract for the in-match shell, but replace the old
 * Arsenal workbench with one small summary and a clean route to the real editor.
 */
export function collapseCampaignLoadoutMenu(mount: HTMLElement, session: GameSession): void {
  if (session.mode !== "campaign") return;
  const page = mount.querySelector<HTMLElement>("#page-loadout");
  if (!page) return;

  const name = page.querySelector<HTMLInputElement>("[data-build-name]")?.value.trim() || "Current loadout";
  // Cloudflare's HTMLRewriter also declares a global `Element`, so select elements need
  // the same explicit DOM cast used by the main loadout editor.
  const slots = Array.from(
    page.querySelectorAll("[data-loadout-slot]"),
    (slot) => slot as unknown as HTMLSelectElement,
  );
  const assigned = slots.filter((slot) => Number(slot.value) > 0).length;
  const loadoutId = session.party[0]?.loadoutId ?? "loadout-01";

  page.classList.remove("armory-page");
  page.classList.add("campaign-loadout-pause");
  replaceTrustedMarkup(page, `<div class="page-intro"><div><p class="eyebrow">CURRENT LOADOUT</p><h2>${escapeHtml(name)}</h2><p>${assigned} / 16 techniques equipped. Deep editing lives in Loadouts so the pause menu stays focused on the current stage.</p><a class="campaign-loadout-route" href="/loadouts/${encodeURIComponent(loadoutId)}/">Manage loadout →</a></div></div>`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
