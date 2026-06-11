import { MODULE_ID } from "./constants.mjs";
import { IMAGE_SETTING_KEYS, normalizeOnlyBattleImages } from "./core/image-settings.mjs";

const FIELD_LABELS = {
  iso: "ONLYBATTLE.ActorConfig.Iso",
  portrait: "ONLYBATTLE.ActorConfig.Portrait",
  cutin: "ONLYBATTLE.ActorConfig.Cutin",
  criticalCutin: "ONLYBATTLE.ActorConfig.CriticalCutin",
  bloodiedCutin: "ONLYBATTLE.ActorConfig.BloodiedCutin",
  unconsciousCutin: "ONLYBATTLE.ActorConfig.UnconsciousCutin"
};

export class ActorOnlyBattleConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "onlybattle-actor-config",
    classes: ["onlybattle", "onlybattle-actor-config"],
    window: {
      title: "ONLYBATTLE.ActorConfig.Title",
      resizable: true
    },
    position: {
      width: 620,
      height: "auto"
    }
  };

  static PARTS = {
    main: {
      template: "modules/onlybattle/templates/actor-config.hbs"
    }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  async _prepareContext(options) {
    const images = normalizeOnlyBattleImages(this.actor?.getFlag?.(MODULE_ID, "images"));
    return {
      ...(await super._prepareContext(options)),
      actorName: this.actor?.name ?? "",
      fields: IMAGE_SETTING_KEYS.map((key) => ({
        key,
        label: FIELD_LABELS[key],
        path: images[key] ?? ""
      }))
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelector("[data-action='save']")?.addEventListener("click", () => this.save());
    this.element.querySelectorAll("[data-action='browse']").forEach((button) => {
      button.addEventListener("click", (event) => this.browse(event.currentTarget));
    });
    this.element.querySelectorAll("[data-action='clear']").forEach((button) => {
      button.addEventListener("click", (event) => {
        const input = event.currentTarget.closest("[data-image-field]")?.querySelector("[data-image-path]");
        if (input) input.value = "";
      });
    });
  }

  async browse(button) {
    const input = button.closest("[data-image-field]")?.querySelector("[data-image-path]");
    if (!input) return;

    new foundry.applications.apps.FilePicker({
      type: "imagevideo",
      current: input.value,
      callback: (path) => {
        input.value = path;
      }
    }).render(true);
  }

  async save() {
    const images = {};
    for (const input of this.element.querySelectorAll("[data-image-path]")) {
      const key = input.dataset.imagePath;
      const path = input.value?.trim();
      if (IMAGE_SETTING_KEYS.includes(key) && path) images[key] = path;
    }

    if (Object.keys(images).length) {
      await this.actor?.setFlag?.(MODULE_ID, "images", images);
    } else {
      await this.actor?.unsetFlag?.(MODULE_ID, "images");
    }

    ui.notifications?.info(game.i18n.localize("ONLYBATTLE.ActorConfig.Saved"));
    this.render();
  }
}
