import test from "node:test";
import assert from "node:assert/strict";

import {
  getOnlyBattleImageForToken,
  hasOnlyBattleImageSetting,
  normalizeOnlyBattleImages
} from "../scripts/core/image-settings.mjs";
import {
  getIsoImageForToken,
  getPortraitForToken
} from "../scripts/core/scene.mjs";

test("normalizes only path strings for image settings without preloading media", () => {
  assert.deepEqual(normalizeOnlyBattleImages({
    iso: "tokens/iso.webm",
    portrait: "actors/portrait.webp",
    cutin: "",
    other: "ignored.webp"
  }), {
    iso: "tokens/iso.webm",
    portrait: "actors/portrait.webp"
  });
});

test("resolves token and actor flag image paths before legacy world registry paths", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    tokenImages: { iso: "flags/token-iso.webm" },
    actorImages: { iso: "flags/actor-iso.webp", portrait: "flags/actor-portrait.webp" }
  });
  const registry = {
    "Scene.A.Token.source": "legacy/token-iso.webp",
    "Actor.source": { iso: "legacy/actor-iso.webp", portrait: "legacy/actor-portrait.webp" }
  };

  assert.equal(getIsoImageForToken(source, registry), "flags/token-iso.webm");
  assert.equal(getPortraitForToken(source, registry), "flags/actor-portrait.webp");
  assert.equal(hasOnlyBattleImageSetting(source, registry, "iso"), true);
});

test("keeps legacy string registry entries as iso-only fallback", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source"
  });
  const registry = {
    "Actor.source": "legacy/actor-iso.webp"
  };

  assert.equal(getOnlyBattleImageForToken(source, registry, "iso"), "legacy/actor-iso.webp");
  assert.equal(getOnlyBattleImageForToken(source, registry, "portrait"), "");
  assert.equal(getIsoImageForToken(source, registry), "legacy/actor-iso.webp");
  assert.equal(getPortraitForToken(source, registry), "actors/fallback.webp");
});

function token({ uuid, actorUuid, tokenImages = {}, actorImages = {} }) {
  return {
    id: uuid.split(".").at(-1),
    name: uuid,
    document: {
      uuid,
      texture: { src: "tokens/default.webp" },
      getFlag(moduleId, key) {
        return moduleId === "onlybattle" && key === "images" ? tokenImages : undefined;
      }
    },
    actor: {
      uuid: actorUuid,
      name: actorUuid,
      img: "actors/fallback.webp",
      getFlag(moduleId, key) {
        return moduleId === "onlybattle" && key === "images" ? actorImages : undefined;
      }
    }
  };
}
