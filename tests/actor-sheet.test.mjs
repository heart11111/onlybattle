import test from "node:test";
import assert from "node:assert/strict";

import {
  addOnlyBattleActorHeaderButton,
  addOnlyBattleActorHeaderControl,
  getActorFromSheet
} from "../scripts/actor-sheet.mjs";

test("reads the actor from common actor sheet shapes", () => {
  const actor = { uuid: "Actor.test" };

  assert.equal(getActorFromSheet({ actor }), actor);
  assert.equal(getActorFromSheet({ document: actor }), actor);
});

test("adds a lightweight actor sheet header button without creating the config app early", async () => {
  let imported = false;
  const actor = { uuid: "Actor.test" };
  const buttons = [];

  addOnlyBattleActorHeaderButton({ actor }, buttons, async () => {
    imported = true;
    return {
      ActorOnlyBattleConfig: class {
        constructor(document) {
          this.document = document;
        }

        render(force) {
          assert.equal(this.document, actor);
          assert.equal(force, true);
        }
      }
    };
  });

  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].class, "onlybattle-actor-config");
  assert.equal(imported, false);

  await buttons[0].onclick();

  assert.equal(imported, true);
});

test("adds a lightweight ApplicationV2 actor sheet header control", async () => {
  let imported = false;
  const actor = { uuid: "Actor.test" };
  const controls = [];

  addOnlyBattleActorHeaderControl({ actor }, controls, async () => {
    imported = true;
    return {
      ActorOnlyBattleConfig: class {
        constructor(document) {
          this.document = document;
        }

        render(force) {
          assert.equal(this.document, actor);
          assert.equal(force, true);
        }
      }
    };
  });

  assert.equal(controls.length, 1);
  assert.equal(controls[0].action, "onlybattleActorConfig");
  assert.equal(imported, false);

  await controls[0].callback();

  assert.equal(imported, true);
});
