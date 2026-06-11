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

test("combat overlay separates large event cut-ins from side portraits", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  await manager.show({
    title: "Rapier",
    source: token({
      uuid: "Scene.A.Token.ally",
      actorUuid: "Actor.ally",
      x: 100,
      y: 100,
      disposition: 1
    }),
    targets: [
      token({
        uuid: "Scene.A.Token.enemy",
        actorUuid: "Actor.enemy",
        x: 300,
        y: 100,
        disposition: -1
      })
    ],
    stage: "critical",
    outcome: "ONLYBATTLE.Overlay.Critical",
    damageType: ""
  });

  assert.deepEqual(manager.app.viewState.cutins.enemies, []);
  assert.deepEqual(manager.app.viewState.cutins.allies.map((portrait) => portrait.id), ["Scene.A.Token.ally"]);
  assert.deepEqual(manager.app.viewState.scene.portraits.enemies.map((portrait) => portrait.id), ["Scene.A.Token.enemy"]);
  assert.deepEqual(manager.app.viewState.scene.portraits.allies.map((portrait) => portrait.id), ["Scene.A.Token.ally"]);
});

test("combat overlay uses event-specific cut-in art when configured", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const source = token({
    uuid: "Scene.A.Token.ally",
    actorUuid: "Actor.ally",
    x: 100,
    y: 100,
    disposition: 1
  });
  source.actor.getFlag = (moduleId, key) => moduleId === "onlybattle" && key === "images"
    ? { criticalCutin: "actors/ally-critical.webm" }
    : undefined;

  await manager.show({
    title: "Rapier",
    source,
    targets: [
      token({
        uuid: "Scene.A.Token.enemy",
        actorUuid: "Actor.enemy",
        x: 300,
        y: 100,
        disposition: -1
      })
    ],
    stage: "critical",
    outcome: "ONLYBATTLE.Overlay.Critical",
    damageType: ""
  });

  assert.equal(manager.app.viewState.cutins.allies[0].img, "actors/ally-critical.webm");
  assert.equal(manager.app.viewState.cutins.allies[0].isVideo, true);
});

test("combat overlay promotes critical cut-ins into a cinematic banner", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const source = token({
    uuid: "Scene.A.Token.ally",
    actorUuid: "Actor.ally",
    x: 100,
    y: 100,
    disposition: 1
  });
  source.actor.getFlag = (moduleId, key) => moduleId === "onlybattle" && key === "images"
    ? { criticalCutin: "actors/ally-critical.webp" }
    : undefined;

  await manager.show({
    title: "Rapier",
    source,
    targets: [
      token({
        uuid: "Scene.A.Token.enemy",
        actorUuid: "Actor.enemy",
        x: 300,
        y: 100,
        disposition: -1
      })
    ],
    stage: "critical",
    outcome: "ONLYBATTLE.Overlay.Critical",
    damageType: "piercing"
  });

  assert.deepEqual(manager.app.viewState.cinematicCutin, {
    ...manager.app.viewState.cutins.allies[0],
    side: "ally",
    stage: "critical",
    title: "Rapier"
  });
});

test("combat overlay keeps critical cut-ins visible when damage follows immediately", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  const source = token({
    uuid: "Scene.A.Token.ally",
    actorUuid: "Actor.ally",
    x: 100,
    y: 100,
    disposition: 1
  });
  const target = token({
    uuid: "Scene.A.Token.enemy",
    actorUuid: "Actor.enemy",
    x: 300,
    y: 100,
    disposition: -1
  });

  await manager.show({
    title: "Rapier",
    source,
    targets: [target],
    stage: "critical",
    outcome: "ONLYBATTLE.Overlay.Critical",
    damageType: ""
  });
  await manager.show({
    title: "Rapier",
    source,
    targets: [target],
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage",
    damageType: "piercing"
  });

  assert.deepEqual(manager.app.viewState.cutins.allies.map((portrait) => portrait.id), ["Scene.A.Token.ally"]);
  assert.equal(manager.app.viewState.cutins.allies[0].label, "ONLYBATTLE.Overlay.CriticalBang");
});

test("combat overlay promotes bloodied targets into large event cut-ins", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  await manager.show({
    title: "Rapier",
    source: token({
      uuid: "Scene.A.Token.ally",
      actorUuid: "Actor.ally",
      x: 100,
      y: 100,
      disposition: 1
    }),
    targets: [
      token({
        uuid: "Scene.A.Token.enemy",
        actorUuid: "Actor.enemy",
        x: 300,
        y: 100,
        disposition: -1
      })
    ],
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage",
    damageSummaries: [{
      tokenUuid: "Scene.A.Token.enemy",
      actorUuid: "Actor.enemy",
      damageText: "-12",
      hpText: "8 HP",
      bloodied: true
    }]
  });

  assert.deepEqual(manager.app.viewState.cutins.allies, []);
  assert.deepEqual(manager.app.viewState.cutins.enemies.map((portrait) => portrait.id), ["Scene.A.Token.enemy"]);
  assert.equal(manager.app.viewState.cutins.enemies[0].label, "ONLYBATTLE.Overlay.BloodiedBang");
});

test("combat overlay promotes unconscious targets into large event cut-ins", async () => {
  const { getOverlayManager } = await import("../scripts/overlay-manager.mjs");
  const manager = getOverlayManager();
  manager.close();

  await manager.show({
    title: "Rapier",
    source: token({
      uuid: "Scene.A.Token.ally",
      actorUuid: "Actor.ally",
      x: 100,
      y: 100,
      disposition: 1
    }),
    targets: [
      token({
        uuid: "Scene.A.Token.enemy",
        actorUuid: "Actor.enemy",
        x: 300,
        y: 100,
        disposition: -1
      })
    ],
    stage: "damage",
    outcome: "ONLYBATTLE.Overlay.Damage",
    damageSummaries: [{
      tokenUuid: "Scene.A.Token.enemy",
      actorUuid: "Actor.enemy",
      damageText: "-18",
      hpText: "0 HP",
      unconscious: true
    }]
  });

  assert.deepEqual(manager.app.viewState.cutins.allies, []);
  assert.deepEqual(manager.app.viewState.cutins.enemies.map((portrait) => portrait.id), ["Scene.A.Token.enemy"]);
  assert.equal(manager.app.viewState.cutins.enemies[0].label, "ONLYBATTLE.Overlay.UnconsciousBang");
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

test("combat overlay schedules attack stages to close when the roll is cancelled", async () => {
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
      stage: "attack",
      outcome: "",
      damageType: ""
    });
  } finally {
    manager.close();
    globalThis.setTimeout = oldSetTimeout;
    globalThis.clearTimeout = oldClearTimeout;
  }

  assert.deepEqual(scheduledDelays, [6500]);
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

function token({ uuid, actorUuid, x, y, disposition = 0 }) {
  return {
    id: uuid.split(".").at(-1),
    name: uuid,
    center: { x, y },
    document: {
      uuid,
      texture: { src: "tokens/default.webp" },
      disposition
    },
    actor: {
      uuid: actorUuid,
      img: "actors/fallback.webp"
    }
  };
}
