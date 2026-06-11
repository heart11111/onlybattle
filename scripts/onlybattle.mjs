import { MODULE_ID } from "./constants.mjs";
import { getInactiveRequiredModules } from "./core/dependencies.mjs";
import { registerSettings } from "./settings.mjs";
import { registerMidiTargetingHook } from "./wrappers.mjs";
import { getOverlayManager, registerMidiOverlayHooks } from "./overlay-manager.mjs";
import { registerAutoAnimationsBridge } from "./compat/autoanimations-bridge.mjs";
import { registerActorSheetHooks } from "./actor-sheet.mjs";
import {
  buildTomitakeBridgeEvent,
  emitTomitakeBridgeEvent,
  isTomitakeBridgeEnabled
} from "./tomitake-bridge.mjs";
import { warn } from "./logger.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerActorSheetHooks();
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
  if (game.modules.get("autoanimations")?.active) {
    const overlay = getOverlayManager();
    registerAutoAnimationsBridge({
      showIsoAnimation: (payload) => overlay.showIsoAnimation(payload)
    });
  }

  globalThis.OnlyBattle = {
    moduleId: MODULE_ID,
    overlay: getOverlayManager(),
    tomitakeBridge: {
      buildEvent: buildTomitakeBridgeEvent,
      emitEvent: emitTomitakeBridgeEvent,
      isEnabled: isTomitakeBridgeEnabled
    }
  };
});
