import test from "node:test";
import assert from "node:assert/strict";

import {
  isAutomationOnlyWorkflow,
  isExternalTargetWorkflow,
  shouldAnimateDamageWorkflow,
  shouldAnimateMidiWorkflow
} from "../scripts/core/workflow-filter.mjs";

test("animates midi-qol workflows that were targeted by OnlyBattle", () => {
  const workflow = {
    workflowOptions: {
      targetUuids: ["Scene.A.Token.target"],
      onlybattle: {
        handledTargeting: true
      }
    }
  };

  assert.equal(shouldAnimateMidiWorkflow(workflow), true);
});

test("skips CPR-style synthetic workflows that provide explicit target UUIDs", () => {
  const workflow = {
    workflowOptions: {
      targetUuids: ["Scene.A.Token.target"],
      autoRollAttack: true,
      autoFastDamage: true
    }
  };

  assert.equal(isExternalTargetWorkflow(workflow), true);
  assert.equal(shouldAnimateMidiWorkflow(workflow), false);
});

test("skips automation-only midi activity workflows", () => {
  const workflow = {
    activity: {
      midiProperties: {
        automationOnly: true
      }
    }
  };

  assert.equal(isAutomationOnlyWorkflow(workflow), true);
  assert.equal(shouldAnimateMidiWorkflow(workflow), false);
});

test("still allows damage overlays for automatic over-time workflows", () => {
  const workflow = {
    workflowOptions: {
      isOverTime: true,
      targetUuids: ["Scene.A.Token.target"]
    },
    damageDetail: [
      { type: "radiant", value: 8 }
    ],
    targets: new Set([{ id: "target" }])
  };

  assert.equal(isAutomationOnlyWorkflow(workflow), true);
  assert.equal(isExternalTargetWorkflow(workflow), true);
  assert.equal(shouldAnimateMidiWorkflow(workflow), false);
  assert.equal(shouldAnimateDamageWorkflow(workflow), true);
});

test("allows ordinary player midi workflows without explicit external targeting", () => {
  assert.equal(shouldAnimateMidiWorkflow({ workflowOptions: {} }), true);
});
