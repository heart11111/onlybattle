import test from "node:test";
import assert from "node:assert/strict";

import { firstNonEmptyCollection, hasValues } from "../scripts/core/collections.mjs";

test("detects non-empty arrays, sets, maps, and iterables", () => {
  assert.equal(hasValues(["target"]), true);
  assert.equal(hasValues(new Set(["target"])), true);
  assert.equal(hasValues(new Map([["target", true]])), true);
  assert.equal(hasValues(new Set()), false);
  assert.equal(hasValues([]), false);
  assert.equal(hasValues(null), false);
});

test("does not treat strings as target collections", () => {
  assert.equal(hasValues("Scene.A.Token.target"), false);
});

test("returns the first collection that contains values", () => {
  const empty = new Set();
  const targets = new Set([{ id: "target" }]);

  assert.equal(firstNonEmptyCollection(null, empty, targets), targets);
});
