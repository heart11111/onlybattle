import test from "node:test";
import assert from "node:assert/strict";

import {
  getDamageEffect,
  normalizeDamageType
} from "../scripts/core/damage-effects.mjs";

test("normalizes dnd5e damage type labels for CSS effect lookup", () => {
  assert.equal(normalizeDamageType(" Piercing "), "piercing");
  assert.equal(normalizeDamageType("Fire, Magical"), "fire");
  assert.equal(normalizeDamageType(""), "");
});

test("maps physical damage types to the temporary impact effect", () => {
  assert.deepEqual(getDamageEffect("piercing"), {
    key: "impact",
    damageType: "piercing"
  });
  assert.deepEqual(getDamageEffect("slashing"), {
    key: "impact",
    damageType: "slashing"
  });
});

test("maps elemental damage types to lightweight CSS effect variants", () => {
  assert.deepEqual(getDamageEffect("fire"), {
    key: "fire",
    damageType: "fire"
  });
  assert.deepEqual(getDamageEffect("lightning"), {
    key: "lightning",
    damageType: "lightning"
  });
});

test("falls back to impact when a damage type has no temporary variant yet", () => {
  assert.deepEqual(getDamageEffect("custom-radiant-sword"), {
    key: "impact",
    damageType: "custom-radiant-sword"
  });
});
