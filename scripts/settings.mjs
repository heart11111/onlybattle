import { MODULE_ID, SETTINGS } from "./constants.mjs";
import { IsometricRegistryConfig } from "./registry-app.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.showMidiTargetConfirmation, {
    name: "ONLYBATTLE.Settings.ShowMidiTargetConfirmation.Name",
    hint: "ONLYBATTLE.Settings.ShowMidiTargetConfirmation.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, SETTINGS.onlyInCombat, {
    name: "ONLYBATTLE.Settings.OnlyInCombat.Name",
    hint: "ONLYBATTLE.Settings.OnlyInCombat.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.isometricRegistry, {
    name: "ONLYBATTLE.Settings.IsometricRegistry.Name",
    hint: "ONLYBATTLE.Settings.IsometricRegistry.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, SETTINGS.enableAutoAnimationsBridge, {
    name: "ONLYBATTLE.Settings.EnableAutoAnimationsBridge.Name",
    hint: "ONLYBATTLE.Settings.EnableAutoAnimationsBridge.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, SETTINGS.tomitakeBridgeEnabled, {
    name: "ONLYBATTLE.Settings.TomitakeBridgeEnabled.Name",
    hint: "ONLYBATTLE.Settings.TomitakeBridgeEnabled.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.registerMenu(MODULE_ID, "isometricRegistryMenu", {
    name: "ONLYBATTLE.Registry.MenuName",
    label: "ONLYBATTLE.Registry.MenuLabel",
    hint: "ONLYBATTLE.Registry.MenuHint",
    icon: "fa-solid fa-images",
    type: IsometricRegistryConfig,
    restricted: true
  });

  game.settings.register(MODULE_ID, SETTINGS.debug, {
    name: "ONLYBATTLE.Settings.Debug.Name",
    hint: "ONLYBATTLE.Settings.Debug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

export function getIsometricRegistry() {
  return getSetting(SETTINGS.isometricRegistry) ?? {};
}
