import test from "node:test";
import assert from "node:assert/strict";

test("registers midi attack completion hooks for finalized critical state", async () => {
  class ApplicationV2 {}
  const HandlebarsApplicationMixin = (Base) => class extends Base {};
  const registeredHooks = [];

  globalThis.foundry = {
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin },
      apps: { FilePicker: class {} }
    },
    utils: {
      mergeObject: (base, update) => ({ ...base, ...update })
    }
  };
  globalThis.game = {
    settings: {
      get: (_moduleId, key) => key === "isometricRegistry" ? {} : false
    },
    user: { targets: new Set() }
  };
  globalThis.canvas = { tokens: { controlled: [] } };
  globalThis.Hooks = {
    on: (name, callback) => {
      registeredHooks.push({ name, callback });
      return registeredHooks.length;
    }
  };

  const { registerMidiOverlayHooks } = await import(`../scripts/overlay-manager.mjs?hooks=${Date.now()}`);
  registerMidiOverlayHooks();

  assert.equal(registeredHooks.some((hook) => hook.name === "midi-qol.AttackRollComplete"), true);
});
