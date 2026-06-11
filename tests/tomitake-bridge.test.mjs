import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTomitakeBridgeEvent,
  emitTomitakeBridgeEvent
} from "../scripts/tomitake-bridge.mjs";

test("Tomitake bridge does not emit when disabled", () => {
  const calls = [];
  globalThis.game = {
    settings: { get: () => false },
    modules: new Map([["created-gallery", { active: true }]])
  };
  globalThis.Hooks = { callAll: (...args) => calls.push(args) };

  assert.equal(emitTomitakeBridgeEvent({ title: "Rapier" }), false);
  assert.deepEqual(calls, []);
});

test("Tomitake bridge does not emit when created-gallery is inactive", () => {
  const calls = [];
  globalThis.game = {
    settings: { get: (_moduleId, key) => key === "tomitakeBridgeEnabled" },
    modules: new Map([["created-gallery", { active: false }]])
  };
  globalThis.Hooks = { callAll: (...args) => calls.push(args) };

  assert.equal(emitTomitakeBridgeEvent({ title: "Rapier" }), false);
  assert.deepEqual(calls, []);
});

test("Tomitake bridge does not emit without the created-gallery module key", () => {
  const calls = [];
  globalThis.game = {
    settings: {
      get: (moduleId, key) => moduleId === "onlybattle" && key === "tomitakeBridgeEnabled"
    },
    modules: new Map([["created-gallery", { active: true }]])
  };
  globalThis.Hooks = { callAll: (...args) => calls.push(args) };

  assert.equal(emitTomitakeBridgeEvent({ title: "Rapier" }), false);
  assert.deepEqual(calls, []);
});

test("Tomitake bridge emits compact OnlyBattle combat payloads", () => {
  const calls = [];
  globalThis.game = {
    settings: {
      get: (moduleId, key) => {
        if (moduleId === "onlybattle" && key === "tomitakeBridgeEnabled") return true;
        if (moduleId === "created-gallery" && key === "moduleKey") return "test-key";
        return "";
      }
    },
    modules: new Map([["created-gallery", { active: true }]]),
    combat: { id: "combat-1", round: 2, turn: 1 }
  };
  globalThis.canvas = {
    scene: { id: "scene-1", uuid: "Scene.scene-1", name: "Forest" }
  };
  globalThis.Hooks = { callAll: (name, payload) => calls.push([name, payload]) };

  const event = buildTomitakeBridgeEvent({
    title: "Rapier",
    stage: "critical",
    outcome: "ONLYBATTLE.Overlay.Critical",
    damageType: "piercing",
    source: token("Scene.scene-1.Token.source", "Actor.source"),
    targets: [token("Scene.scene-1.Token.target", "Actor.target")],
    damageSummaries: [{ tokenUuid: "Scene.scene-1.Token.target", damageText: "-8", hpText: "3 HP" }]
  });

  assert.equal(emitTomitakeBridgeEvent(event), true);
  assert.deepEqual(calls.map(([name]) => name), [
    "onlybattle.tomitakeEvent",
    "createdGallery.onlyBattleEvent"
  ]);

  const payload = calls[0][1];
  assert.equal(payload.schemaVersion, "onlybattle.tomitake-event.v1");
  assert.equal(payload.title, "Rapier");
  assert.equal(payload.stage, "critical");
  assert.equal(payload.source.uuid, "Scene.scene-1.Token.source");
  assert.equal(payload.targets[0].actorUuid, "Actor.target");
  assert.equal(payload.scene.uuid, "Scene.scene-1");
  assert.deepEqual(payload.combat, { id: "combat-1", round: 2, turn: 1 });
  assert.deepEqual(payload.damageSummaries, [{ tokenUuid: "Scene.scene-1.Token.target", damageText: "-8", hpText: "3 HP" }]);
  assert.equal("document" in payload.source, false);
  assert.equal("actor" in payload.source, false);
});

function token(uuid, actorUuid) {
  return {
    id: uuid.split(".").at(-1),
    name: uuid,
    center: { x: 150, y: 250 },
    document: {
      uuid,
      x: 100,
      y: 200,
      width: 1,
      height: 1,
      elevation: 10,
      disposition: -1
    },
    actor: {
      id: actorUuid.split(".").at(-1),
      uuid: actorUuid
    }
  };
}
