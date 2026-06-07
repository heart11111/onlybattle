import { MODULE_ID } from "./constants.mjs";
import {
  activateCanvasTargetTool,
  restoreCanvasToolState
} from "./core/canvas-controls.mjs";
import { getActivityTargetPolicy, validateTargetCount } from "./core/targeting.mjs";

export async function requestOnlyBattleTargets(activity, options = {}) {
  const dialog = new OnlyBattleTargetDialog(activity, options);
  return dialog.wait();
}

class OnlyBattleTargetDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "onlybattle-target-dialog",
    classes: ["onlybattle", "onlybattle-target-dialog"],
    window: {
      title: "ONLYBATTLE.TargetDialog.Title",
      resizable: false
    },
    position: {
      width: 360
    }
  };

  static PARTS = {
    main: {
      template: "modules/onlybattle/templates/target-dialog.hbs"
    }
  };

  constructor(activity, options = {}) {
    super(options.application ?? {});
    this.activity = activity;
    this.clearExisting = options.clearExisting ?? true;
    this.targetPolicy = options.targetPolicy ?? getActivityTargetPolicy(activity);
    this.templateMode = options.templateMode ?? this.targetPolicy.hasTemplate;
    this.previousTargets = options.previousTargets ?? Array.from(game.user?.targets ?? []);
    this.previousCanvasTool = null;
    this.canvasToolRestored = false;
    this.targetHook = null;
    this.resolved = false;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  async wait() {
    await this.render({ force: true });
    return this.promise;
  }

  async _prepareContext(options) {
    const targets = Array.from(game.user?.targets ?? []).map((token) => ({
      id: token.id,
      name: token.name,
      img: token.document?.texture?.src ?? token.document?.img ?? token.actor?.img ?? "icons/svg/mystery-man.svg"
    }));

    return {
      ...(await super._prepareContext(options)),
      activityName: this.activity?.name ?? this.activity?.item?.name ?? game.i18n.localize("ONLYBATTLE.TargetDialog.Activity"),
      itemName: this.activity?.item?.name ?? "",
      targetHint: getTargetHint(this.targetPolicy, this.templateMode),
      maxTargets: this.targetPolicy.maxTargets,
      allowsMultiple: this.targetPolicy.allowsMultiple,
      targetLabel: this.targetPolicy.targetLabel,
      targets,
      hasTargets: targets.length > 0
    };
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.previousCanvasTool = await activateCanvasTargetTool();
    if (this.clearExisting) clearUserTargets();

    this.targetHook = Hooks.on("targetToken", (user) => {
      if (user !== game.user) return;
      this.render();
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("[data-action='confirm']")?.addEventListener("click", () => this.confirm());
    this.element.querySelector("[data-action='cancel']")?.addEventListener("click", () => this.cancel());
    this.element.querySelector("[data-action='clear']")?.addEventListener("click", () => {
      clearUserTargets();
      this.render();
    });
  }

  async close(options = {}) {
    if (this.targetHook !== null) {
      Hooks.off("targetToken", this.targetHook);
      this.targetHook = null;
    }

    await this.restoreCanvasTool();

    if (!this.resolved) {
      this.resolved = true;
      this.resolve(false);
    }

    return super.close(options);
  }

  async restoreCanvasTool() {
    if (this.canvasToolRestored) return;
    this.canvasToolRestored = true;
    await restoreCanvasToolState(this.previousCanvasTool);
  }

  confirm() {
    const targets = Array.from(game.user?.targets ?? []);
    const validation = validateTargetCount(targets, this.targetPolicy);
    if (validation) {
      ui.notifications?.warn(game.i18n.format(validation, {
        count: this.targetPolicy.maxTargets ?? 1
      }));
      return;
    }

    this.resolved = true;
    this.resolve(targets);
    this.close();
  }

  cancel() {
    restoreTargets(this.previousTargets);
    this.resolved = true;
    this.resolve(false);
    this.close();
  }
}

function getTargetHint(policy, templateMode) {
  if (templateMode) {
    return game.i18n.format("ONLYBATTLE.TargetDialog.TemplateHint", {
      count: policy.templateCount ?? 1,
      target: policy.targetLabel
    });
  }

  if (policy.maxTargets && policy.maxTargets > 1) {
    return game.i18n.format("ONLYBATTLE.TargetDialog.MultiTargetHint", {
      count: policy.maxTargets,
      target: policy.targetLabel
    });
  }

  return game.i18n.format("ONLYBATTLE.TargetDialog.SingleTargetHint", {
    target: policy.targetLabel
  });
}

function clearUserTargets() {
  for (const target of Array.from(game.user?.targets ?? [])) {
    target.setTarget(false, { releaseOthers: false });
  }
}

function restoreTargets(targets) {
  clearUserTargets();
  for (const target of targets) {
    target.setTarget(true, { releaseOthers: false });
  }
}

export function isOnlyBattleTargetDialog(app) {
  return app?.id === `${MODULE_ID}-target-dialog` || app instanceof OnlyBattleTargetDialog;
}
