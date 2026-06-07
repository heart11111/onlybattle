import test from "node:test";
import assert from "node:assert/strict";

import {
  inferDamageType,
  inferMidiAttackOutcome,
  shouldShowBloodiedCutin,
  shouldShowDamageNumbers,
  workflowDamageSummaries,
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

test("reads applied damage and remaining HP from midi-qol damageList", () => {
  const target = {
    document: { uuid: "Scene.A.Token.target" },
    actor: {
      uuid: "Actor.target",
      hasPlayerOwner: false,
      system: { attributes: { hp: { max: 30 } } }
    }
  };

  assert.deepEqual(
    workflowDamageSummaries({
      damageList: [{
        targetUuid: "Scene.A.Token.target",
        actorUuid: "Actor.target",
        hpDamage: 7,
        tempDamage: 3,
        oldHP: 25,
        newHP: 18
      }]
    }, [target], { playerDamageCard: "npcplayerresults" }),
    [{
      tokenUuid: "Scene.A.Token.target",
      actorUuid: "Actor.target",
      damageText: "-10",
      hpText: "18 HP",
      bloodied: false
    }]
  );
});

test("respects midi-qol player damage card visibility for NPC remaining HP", () => {
  const npc = {
    document: { uuid: "Scene.A.Token.npc" },
    actor: {
      uuid: "Actor.npc",
      hasPlayerOwner: false,
      system: { attributes: { hp: { max: 30 } } }
    }
  };

  assert.equal(shouldShowDamageNumbers(npc, { playerDamageCard: "playerresults" }), false);
  assert.equal(shouldShowDamageNumbers(npc, { playerDamageCard: "npcplayerresults" }), true);
  assert.equal(shouldShowDamageNumbers(null, { playerDamageCard: "playerresults" }), false);
});

test("detects a midi-qol wounded threshold crossing for the bloodied cut-in", () => {
  const target = {
    actor: {
      system: { attributes: { hp: { max: 40 } } }
    }
  };
  const settings = {
    addWounded: 50,
    addWoundedStyle: "overlay",
    midiWoundedCondition: "bloodied"
  };

  assert.equal(shouldShowBloodiedCutin({ oldHP: 25, newHP: 18 }, target, settings), true);
  assert.equal(shouldShowBloodiedCutin({ oldHP: 18, newHP: 12 }, target, settings), false);
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

test("infers midi critical before ordinary hit targets", () => {
  assert.deepEqual(
    inferMidiAttackOutcome({
      hitTargets: new Set([{ id: "target" }]),
      attackRoll: { total: 20, isCritical: true }
    }),
    {
      outcome: "ONLYBATTLE.Overlay.Critical",
      outcomeBadge: "ONLYBATTLE.Overlay.CriticalBang",
      stage: "critical"
    }
  );
});
