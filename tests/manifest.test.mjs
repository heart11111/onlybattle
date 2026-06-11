import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

test("declares midi-qol as a required module dependency", () => {
  const requires = manifest.relationships?.requires ?? [];
  const recommends = manifest.relationships?.recommends ?? [];

  assert.ok(requires.some((relationship) => relationship.id === "midi-qol" && relationship.type === "module"));
  assert.equal(recommends.some((relationship) => relationship.id === "midi-qol"), false);
});

test("does not require lib-wrapper because OnlyBattle stays on midi-qol workflow hooks", () => {
  const requires = manifest.relationships?.requires ?? [];

  assert.equal(requires.some((relationship) => relationship.id === "lib-wrapper"), false);
});
