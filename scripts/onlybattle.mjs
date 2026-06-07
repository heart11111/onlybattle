import { MODULE_ID } from "./constants.mjs";
import { getInactiveRequiredModules } from "./core/dependencies.mjs";
import { registerSettings } from "./settings.mjs";
import { registerMidiTargetingHook } from "./wrappers.mjs";
import { getOverlayManager, registerMidiOverlayHooks } from "./overlay-manager.mjs";
import { warn } from "./logger.mjs";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  if (game.system?.id !== "dnd5e") {
    warn("OnlyBattle is enabled, but the active system is not dnd5e. No midi-qol hooks were registered.");
    return;
  }

  const inactiveRequiredModules = getInactiveRequiredModules(game.modules);
  if (inactiveRequiredModules.length) {
    const modules = inactiveRequiredModules.join(", ");
    ui.notifications?.error(game.i18n.format("ONLYBATTLE.Error.RequiredModulesInactive", { modules }));
    warn(`OnlyBattle requires active module(s): ${modules}. No midi-qol hooks were registered.`);
    return;
  }

  registerMidiTargetingHook();
  registerMidiOverlayHooks();

  globalThis.OnlyBattle = {
    moduleId: MODULE_ID,
    overlay: getOverlayManager()
  };
});
