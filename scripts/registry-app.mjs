import { SETTINGS } from "./constants.mjs";
import { getIsometricRegistry, setSetting } from "./settings.mjs";

export class IsometricRegistryConfig extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "onlybattle-isometric-registry",
    classes: ["onlybattle", "onlybattle-registry"],
    window: {
      title: "ONLYBATTLE.Registry.Title",
      resizable: true
    },
    position: {
      width: 620,
      height: 520
    }
  };

  static PARTS = {
    main: {
      template: "modules/onlybattle/templates/isometric-registry.hbs"
    }
  };

  async _prepareContext(options) {
    const entries = Object.entries(getIsometricRegistry()).map(([uuid, value]) => ({
      uuid,
      path: typeof value === "string" ? value : value?.iso ?? ""
    }));
    return {
      ...(await super._prepareContext(options)),
      entries
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelector("[data-action='add']")?.addEventListener("click", () => this.addRow());
    this.element.querySelector("[data-action='save']")?.addEventListener("click", () => this.save());
    this.element.querySelectorAll("[data-action='remove']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.currentTarget.closest("[data-registry-row]")?.remove();
      });
    });
    this.element.querySelectorAll("[data-action='browse']").forEach((button) => {
      button.addEventListener("click", (event) => this.browse(event.currentTarget));
    });
  }

  addRow() {
    const tbody = this.element.querySelector("[data-registry-rows]");
    const row = document.createElement("tr");
    row.dataset.registryRow = "true";
    row.innerHTML = `
      <td><input type="text" name="uuid" placeholder="Actor... or Scene...Token..." /></td>
      <td class="onlybattle-registry-path">
        <input type="text" name="path" placeholder="modules/onlybattle/tokens/example.webp" />
        <button type="button" data-action="browse"><i class="fa-solid fa-folder-open"></i></button>
      </td>
      <td><button type="button" data-action="remove"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.append(row);
    row.querySelector("[data-action='remove']")?.addEventListener("click", () => row.remove());
    row.querySelector("[data-action='browse']")?.addEventListener("click", (event) => this.browse(event.currentTarget));
  }

  async browse(button) {
    const input = button.closest("td")?.querySelector("input[name='path']");
    if (!input) return;

    new foundry.applications.apps.FilePicker({
      type: "image",
      current: input.value,
      callback: (path) => {
        input.value = path;
      }
    }).render(true);
  }

  async save() {
    const registry = {};
    for (const row of this.element.querySelectorAll("[data-registry-row]")) {
      const uuid = row.querySelector("input[name='uuid']")?.value?.trim();
      const path = row.querySelector("input[name='path']")?.value?.trim();
      if (uuid && path) registry[uuid] = path;
    }

    await setSetting(SETTINGS.isometricRegistry, registry);
    ui.notifications?.info(game.i18n.localize("ONLYBATTLE.Registry.Saved"));
    this.render();
  }
}
