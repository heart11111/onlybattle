import test from "node:test";
import assert from "node:assert/strict";

import {
  createUsageWithMidiSuppression,
  getActivityTargetPolicy,
  hasExplicitExternalTargeting,
  isCombatEncounterAvailable,
  needsOnlyBattleTargeting,
  shouldClearExistingTargetsForDialog,
  shouldSuppressMidiTargetConfirmation,
  validateTargetCount
} from "../scripts/core/targeting.mjs";

test("targets attack activities during combat even when an existing target is present", () => {
  const activity = {
    type: "attack",
    attack: { bonus: "0" },
    item: { type: "weapon" },
    target: { affects: { type: "creature" } }
  };

  assert.equal(needsOnlyBattleTargeting(activity, { inCombat: true, existingTargetCount: 1 }), true);
});

test("treats an existing unstarted combat as a valid OnlyBattle encounter", () => {
  assert.equal(isCombatEncounterAvailable({ started: false }), true);
  assert.equal(isCombatEncounterAvailable(null), false);
});

test("does not target self-only utility activities", () => {
  const activity = {
    type: "utility",
    item: { type: "feat" },
    target: { affects: { type: "self" } }
  };

  assert.equal(needsOnlyBattleTargeting(activity, { inCombat: true, existingTargetCount: 0 }), false);
});

test("targets save activities but leaves area template targeting to dnd5e and midi-qol", () => {
  const saveActivity = {
    type: "save",
    item: { type: "spell" },
    target: { affects: { type: "creature" } }
  };
  const areaActivity = {
    type: "damage",
    item: { type: "spell" },
    target: { template: { type: "circle" }, affects: { type: "creature" } }
  };

  assert.equal(needsOnlyBattleTargeting(saveActivity, { inCombat: true }), true);
  assert.equal(needsOnlyBattleTargeting(areaActivity, { inCombat: true }), false);
});

test("does not late-target self-origin template activities because automation owns the area", () => {
  const selfTemplateActivity = {
    type: "save",
    item: { type: "spell" },
    target: {
      affects: { type: "self" },
      template: { type: "circle", count: 1, size: 10 }
    }
  };

  assert.equal(needsOnlyBattleTargeting(selfTemplateActivity, { inCombat: true }), false);
});

test("reads multi-target counts from dnd5e activity target data", () => {
  const activity = {
    target: {
      affects: {
        type: "creature",
        count: "3",
        labels: { sheet: "up to three creatures" }
      }
    }
  };

  assert.deepEqual(getActivityTargetPolicy(activity), {
    hasTemplate: false,
    allowsMultiple: true,
    maxTargets: 3,
    minTargets: 1,
    targetLabel: "up to three creatures",
    templateCount: 0
  });
});

test("validates target counts without truncating multi-target selections", () => {
  const policy = getActivityTargetPolicy({ target: { affects: { type: "creature", count: 2 } } });

  assert.equal(validateTargetCount([{}, {}], policy), null);
  assert.equal(validateTargetCount([{}, {}, {}], policy), "ONLYBATTLE.TargetDialog.TooManyTargets");
});

test("detects explicit midi-qol target configs so automated workflows are not retargeted", () => {
  assert.equal(hasExplicitExternalTargeting({ targetUuids: ["Scene.A.Token.1"] }), true);
  assert.equal(hasExplicitExternalTargeting({ targetsToUse: new Set([{}]) }), true);
  assert.equal(hasExplicitExternalTargeting({ ignoreUserTargets: true }), true);
  assert.equal(hasExplicitExternalTargeting({ midiOptions: { targetUuids: ["Scene.A.Token.1"] } }), true);
  assert.equal(hasExplicitExternalTargeting({ midiOptions: { targetsToUse: new Set([{}]) } }), true);
  assert.equal(hasExplicitExternalTargeting({ midiOptions: { ignoreUserTargets: true } }), true);
  assert.equal(hasExplicitExternalTargeting({ midiOptions: { targetUuids: [] } }), false);
});

test("suppresses midi-qol target confirmation by default after OnlyBattle targeting", () => {
  assert.equal(shouldSuppressMidiTargetConfirmation({
    handledByOnlyBattle: true,
    showMidiTargetConfirmation: false
  }), true);
});

test("keeps midi-qol target confirmation when the compatibility setting is enabled", () => {
  assert.equal(shouldSuppressMidiTargetConfirmation({
    handledByOnlyBattle: true,
    showMidiTargetConfirmation: true
  }), false);
});

test("creates a cloned usage config with midi-qol target confirmation disabled", () => {
  const usage = { midiOptions: { workflowOptions: { advantage: true } } };

  const next = createUsageWithMidiSuppression(usage, { suppressMidiTargetConfirmation: true });

  assert.notEqual(next, usage);
  assert.equal(next.midiOptions.workflowOptions.advantage, true);
  assert.equal(next.midiOptions.workflowOptions.targetConfirmation, "never");
});

test("keeps already selected canvas targets when OnlyBattle opens without a template", () => {
  assert.equal(shouldClearExistingTargetsForDialog({
    placedTemplates: [],
    previousTargets: [{ id: "already-targeted" }]
  }), false);
  assert.equal(shouldClearExistingTargetsForDialog({
    placedTemplates: [],
    previousTargets: []
  }), true);
});

test("can suppress duplicate dnd5e measured template creation after OnlyBattle places one", () => {
  const usage = { create: { chatMessage: true } };

  const next = createUsageWithMidiSuppression(usage, {
    suppressMeasuredTemplateCreation: true,
    templateUuids: ["Scene.A.MeasuredTemplate.1"],
    targetUuids: ["Scene.A.Token.1", "Scene.A.Token.2"]
  });

  assert.equal(next.create.chatMessage, true);
  assert.equal(next.create.measuredTemplate, false);
  assert.deepEqual(next.targetUuids, ["Scene.A.Token.1", "Scene.A.Token.2"]);
  assert.deepEqual(next.midiOptions.targetUuids, ["Scene.A.Token.1", "Scene.A.Token.2"]);
  assert.deepEqual(next.midiOptions.workflowOptions.targetUuids, ["Scene.A.Token.1", "Scene.A.Token.2"]);
  assert.deepEqual(next.onlybattle.templateUuids, ["Scene.A.MeasuredTemplate.1"]);
  assert.deepEqual(next.midiOptions.workflowOptions.onlybattle, {
    handledTargeting: true,
    targetUuids: ["Scene.A.Token.1", "Scene.A.Token.2"]
  });
});

test("preserves non-cloneable usage objects while cloning midi workflow options", () => {
  const event = { currentTarget: {} };
  const usage = { event, midiOptions: { workflowOptions: { fastForward: true } } };

  const next = createUsageWithMidiSuppression(usage, { suppressMidiTargetConfirmation: true });

  assert.equal(next.event, event);
  assert.notEqual(next.midiOptions, usage.midiOptions);
  assert.notEqual(next.midiOptions.workflowOptions, usage.midiOptions.workflowOptions);
});
