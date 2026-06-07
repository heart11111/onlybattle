import test from "node:test";
import assert from "node:assert/strict";

test("combat overlay can render when ApplicationV2 exposes getter-only state", async () => {
  class ApplicationV2 {
    get state() {
      return "render-state";
    }

    async _prepareContext() {
      return {};
    }

    async render(options) {
      this.renderOptions = options;
      return this;
    }

    async close() {
      return this;
    }
  }

  const HandlebarsApplicationMixin = (Base) => class extends Base {};

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
  globalThis.Hooks = { on: () => {} };

  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100
  });

  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();

  await assert.doesNotReject(() => manager.show({
    title: "Longsword",
    source,
    targets: [target],
    stage: "attack",
    outcome: "",
    damageType: ""
  }));
});

test("combat overlay keeps prior participants when later animation stages omit targets", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100
  });

  await manager.show({
    title: "Longsword",
    source,
    targets: [target],
    stage: "attack",
    outcome: "",
    damageType: ""
  });

  await manager.show({
    title: "Longsword",
    source,
    targets: [],
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage",
    damageType: "slashing"
  });

  assert.deepEqual(
    manager.app.viewState.scene.tokens.map((sceneToken) => sceneToken.role),
    ["source", "target"]
  );
});

test("combat overlay derives animated outcome badges from animation stage", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  await manager.show({
    title: "Longsword",
    source: token({
      uuid: "Scene.A.Token.source",
      actorUuid: "Actor.source",
      x: 100,
      y: 100
    }),
    targets: [
      token({
        uuid: "Scene.A.Token.target",
        actorUuid: "Actor.target",
        x: 300,
        y: 100
      })
    ],
    stage: "hit",
    outcome: "ONLYBATTLE.Overlay.Hit",
    damageType: ""
  });

  assert.equal(manager.app.viewState.outcomeBadge, "ONLYBATTLE.Overlay.HitBang");
});

test("combat overlay filters the source token out of target portraits", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100
  });

  await manager.show({
    title: "Longsword",
    source,
    targets: [source, target, target],
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage",
    damageType: "piercing"
  });

  assert.deepEqual(
    manager.app.viewState.scene.tokens.map((sceneToken) => sceneToken.id),
    ["Scene.A.Token.source", "Scene.A.Token.target"]
  );
});

test("combat overlay schedules outcome stages to close when damage never follows", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const oldSetTimeout = globalThis.setTimeout;
  const oldClearTimeout = globalThis.clearTimeout;
  const scheduledDelays = [];
  globalThis.setTimeout = (_callback, delay) => {
    scheduledDelays.push(delay);
    return { delay };
  };
  globalThis.clearTimeout = () => {};

  try {
    await manager.show({
      title: "Longsword",
      source: token({
        uuid: "Scene.A.Token.source",
        actorUuid: "Actor.source",
        x: 100,
        y: 100
      }),
      targets: [
        token({
          uuid: "Scene.A.Token.target",
          actorUuid: "Actor.target",
          x: 300,
          y: 100
        })
      ],
      stage: "miss",
      outcome: "ONLYBATTLE.Overlay.Miss",
      damageType: ""
    });
  } finally {
    manager.close();
    globalThis.setTimeout = oldSetTimeout;
    globalThis.clearTimeout = oldClearTimeout;
  }

  assert.deepEqual(scheduledDelays, [1400]);
});

test("combat overlay attaches temporary damage effects only to target tokens", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  await manager.show({
    title: "Rapier",
    source: token({
      uuid: "Scene.A.Token.source",
      actorUuid: "Actor.source",
      x: 100,
      y: 100
    }),
    targets: [
      token({
        uuid: "Scene.A.Token.target",
        actorUuid: "Actor.target",
        x: 300,
        y: 100
      })
    ],
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage",
    damageType: "piercing"
  });

  const source = manager.app.viewState.scene.tokens.find((sceneToken) => sceneToken.role === "source");
  const target = manager.app.viewState.scene.tokens.find((sceneToken) => sceneToken.role === "target");

  assert.equal(source.damageEffect, null);
  assert.deepEqual(target.damageEffect, {
    key: "impact",
    damageType: "piercing"
  });
});

test("damage workflow overlay falls back from empty hitTargets to actual workflow targets", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100
  });

  await manager.showFromWorkflow({
    token: source,
    targets: new Set([target]),
    hitTargets: new Set(),
    item: { name: "Spirit Guardians" },
    damageDetail: [{ type: "radiant" }]
  }, {
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage"
  });

  assert.deepEqual(
    manager.app.viewState.scene.tokens.map((sceneToken) => sceneToken.role),
    ["source", "target"]
  );
  assert.deepEqual(
    manager.app.viewState.scene.tokens.find((sceneToken) => sceneToken.role === "target").damageEffect,
    {
      key: "radiant",
      damageType: "radiant"
    }
  );
});

function token({ uuid, actorUuid, x, y }) {
  return {
    id: uuid.split(".").at(-1),
    name: uuid,
    center: { x, y },
    document: {
      uuid,
      texture: { src: "tokens/default.webp" }
    },
    actor: {
      uuid: actorUuid,
      img: "actors/fallback.webp"
    }
  };
}
