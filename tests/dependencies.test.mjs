import test from "node:test";
import assert from "node:assert/strict";

import { getInactiveRequiredModules } from "../scripts/core/dependencies.mjs";

test("requires midi-qol to be active at runtime", () => {
  const modules = new Map([
    ["midi-qol", { active: false }]
  ]);

  assert.deepEqual(getInactiveRequiredModules(modules), ["midi-qol"]);
});

test("accepts active midi-qol at runtime", () => {
  const modules = new Map([
    ["midi-qol", { active: true }]
  ]);

  assert.deepEqual(getInactiveRequiredModules(modules), []);
});
