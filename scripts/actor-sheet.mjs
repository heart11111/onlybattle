export function registerActorSheetHooks() {
  Hooks.on("getApplicationHeaderButtons", addOnlyBattleActorHeaderButton);
  Hooks.on("getActorSheetHeaderButtons", addOnlyBattleActorHeaderButton);
  Hooks.on("getHeaderControlsApplicationV2", addOnlyBattleActorHeaderControl);
  Hooks.on("getHeaderControlsActorSheetV2", addOnlyBattleActorHeaderControl);
}

export function addOnlyBattleActorHeaderButton(app, buttons, importConfig = () => import("./actor-config-app.mjs")) {
  const actor = getActorFromSheet(app);
  if (!actor || !Array.isArray(buttons)) return;
  if (buttons.some((button) => button.class === "onlybattle-actor-config")) return;

  buttons.unshift({
    label: "OnlyBattle",
    class: "onlybattle-actor-config",
    icon: "fa-solid fa-images",
    onclick: async () => {
      const { ActorOnlyBattleConfig } = await importConfig();
      new ActorOnlyBattleConfig(actor).render(true);
    }
  });
}

export function addOnlyBattleActorHeaderControl(app, controls, importConfig = () => import("./actor-config-app.mjs")) {
  const actor = getActorFromSheet(app);
  if (!actor || !Array.isArray(controls)) return;
  if (controls.some((control) => control.action === "onlybattleActorConfig")) return;

  controls.unshift({
    action: "onlybattleActorConfig",
    icon: "fa-solid fa-images",
    label: "OnlyBattle",
    visible: true,
    ownership: "OWNER",
    callback: async () => {
      const { ActorOnlyBattleConfig } = await importConfig();
      new ActorOnlyBattleConfig(actor).render(true);
    }
  });
}

export function getActorFromSheet(app) {
  return app?.actor ?? app?.document ?? null;
}
