import test from "node:test";
import assert from "node:assert/strict";

import {
  inferDamageType,
  inferMidiAttackOutcome,
  workflowTargets,
  workflowTitle
} from "../scripts/core/workflow-view.mjs";

test("reads workflow title from item before activity fallback", () => {
  assert.equal(workflowTitle({ item: { name: "Rapier" }, activity: { name: "Attack" } }), "Rapier");
  assert.equal(workflowTitle({ activity: { item: { name: "Fire Bolt" } } }), "Fire Bolt");
});

test("damage stages prefer actual damaged target collections", () => {
  const hitTarget = { id: "hit" };
  const failedSave = { id: "failed-save" };
  const ordinaryTarget = { id: "target" };

  assert.deepEqual(
    workflowTargets({
      hitTargets: new Set([hitTarget]),
      failedSaves: new Set([failedSave]),
      targets: new Set([ordinaryTarget])
    }, "damage"),
    [hitTarget]
  );
});

test("damage stages fall back to workflow targets when hit targets are empty", () => {
  const target = { id: "target" };

  assert.deepEqual(
    workflowTargets({
      hitTargets: new Set(),
      targets: new Set([target])
    }, "damage"),
    [target]
  );
});

test("reads damage type from midi detail before dnd5e activity parts", () => {
  assert.equal(inferDamageType({ damageDetail: [{ type: "piercing" }] }), "piercing");
  assert.equal(inferDamageType({
    activity: {
      damage: {
        parts: [{ types: new Set(["radiant"]) }]
      }
    }
  }), "radiant");
});

test("infers midi attack miss when hitTargets are empty and auto check hit is enabled", () => {
  globalThis.game = {
    settings: {
      get: () => ({ autoCheckHit: "all" })
    }
  };

  assert.deepEqual(
    inferMidiAttackOutcome({
      hitTargets: new Set(),
      targets: new Set([{ actor: { system: { attributes: { ac: { value: 20 } } } } }]),
      attackRoll: { total: 10 }
    }),
    {
      outcome: "ONLYBATTLE.Overlay.Miss",
      outcomeBadge: "ONLYBATTLE.Overlay.MissBang",
      stage: "miss"
    }
  );
});
