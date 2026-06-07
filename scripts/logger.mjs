import { MODULE_ID, SETTINGS } from "./constants.mjs";

export function debug(...args) {
  if (!game.settings?.get?.(MODULE_ID, SETTINGS.debug)) return;
  console.debug("OnlyBattle |", ...args);
}

export function warn(...args) {
  console.warn("OnlyBattle |", ...args);
}
