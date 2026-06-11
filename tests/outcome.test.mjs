import test from "node:test";
import assert from "node:assert/strict";

import {
  getOutcomeBadgeKey,
  inferAttackOutcome,
  tokenArmorClass
} from "../scripts/core/outcome.mjs";

test("infers dnd5e hit from attack roll total and target AC", () => {
  const result = inferAttackOutcome([{ total: 18 }], [tokenWithAc(16)]);

  assert.deepEqual(result, {
    stage: "hit",
    outcome: "ONLYBATTLE.Overlay.Hit",
    outcomeBadge: "ONLYBATTLE.Overlay.HitBang"
  });
});

test("infers dnd5e miss from attack roll total and target AC", () => {
  const result = inferAttackOutcome([{ total: 12 }], [tokenWithAc(16)]);

  assert.deepEqual(result, {
    stage: "miss",
    outcome: "ONLYBATTLE.Overlay.Miss",
    outcomeBadge: "ONLYBATTLE.Overlay.MissBang"
  });
});

test("uses dnd5e D20Roll success flags when present", () => {
  assert.equal(inferAttackOutcome([{ total: 1, isSuccess: true }], [tokenWithAc(30)]).stage, "hit");
  assert.equal(inferAttackOutcome([{ total: 30, isFailure: true }], [tokenWithAc(10)]).stage, "miss");
});

test("critical hits and fumbles override numeric AC comparison", () => {
  assert.equal(inferAttackOutcome([{ total: 1, isCritical: true }], [tokenWithAc(30)]).stage, "critical");
  assert.equal(inferAttackOutcome([{ total: 30, isFumble: true }], [tokenWithAc(10)]).stage, "miss");
});

test("extracts target AC from common token actor shapes", () => {
  assert.equal(tokenArmorClass(tokenWithAc(17)), 17);
  assert.equal(tokenArmorClass({ actor: { system: { attributes: { ac: { value: "15" } } } } }), 15);
});

test("maps overlay stages to animated badge localization keys", () => {
  assert.equal(getOutcomeBadgeKey("hit"), "ONLYBATTLE.Overlay.HitBang");
  assert.equal(getOutcomeBadgeKey("critical"), "ONLYBATTLE.Overlay.CriticalBang");
  assert.equal(getOutcomeBadgeKey("miss"), "ONLYBATTLE.Overlay.MissBang");
  assert.equal(getOutcomeBadgeKey("damage"), "ONLYBATTLE.Overlay.DamageBang");
  assert.equal(getOutcomeBadgeKey("attack"), "");
});

function tokenWithAc(ac) {
  return {
    actor: {
      system: {
        attributes: {
          ac: { value: ac }
        }
      }
    }
  };
}
