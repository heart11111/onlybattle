import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCombatScene,
  getIsoImageForToken,
  getPortraitForToken,
  getTokenGridCenter,
  measureTokenDistance,
  projectCanvasToIso
} from "../scripts/core/scene.mjs";

function token({ uuid, actorUuid, x, y, img = "tokens/default.webp", documentX, documentY, width = 1, height = 1 }) {
  return {
    id: uuid.split(".").at(-1),
    name: uuid,
    center: { x, y },
    document: {
      uuid,
      texture: { src: img },
      x: documentX,
      y: documentY,
      width,
      height
    },
    actor: {
      uuid: actorUuid,
      name: actorUuid,
      img: "actors/fallback.webp"
    }
  };
}

test("uses token-specific isometric art before actor art and normal token fallback", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const registry = {
    "Actor.source": "iso/actor-source.webp",
    "Scene.A.Token.source": "iso/token-source.webp"
  };

  assert.equal(getIsoImageForToken(source, registry), "iso/token-source.webp");
  assert.equal(getIsoImageForToken(source, {}), "tokens/default.webp");
});

test("skips empty isometric and token image paths before falling back", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100,
    img: ""
  });
  source.document.img = "tokens/document-main.webp";

  assert.equal(getIsoImageForToken(source, { "Scene.A.Token.source": "" }), "tokens/document-main.webp");

  delete source.document.img;
  assert.equal(getIsoImageForToken(source, { "Actor.source": "" }), "actors/fallback.webp");
});

test("projects canvas coordinates into stable isometric coordinates", () => {
  assert.deepEqual(projectCanvasToIso({ x: 100, y: 100 }, { x: 100, y: 100 }), { x: 0, y: 0 });
  assert.deepEqual(projectCanvasToIso({ x: 200, y: 100 }, { x: 100, y: 100 }), { x: 50, y: 25 });
  assert.deepEqual(projectCanvasToIso({ x: 100, y: 200 }, { x: 100, y: 100 }), { x: -50, y: 25 });
});

test("derives token grid centers from occupied grid cells instead of image center drift", () => {
  const largeTarget = token({
    uuid: "Scene.A.Token.large",
    actorUuid: "Actor.large",
    x: 999,
    y: 999,
    documentX: 100,
    documentY: 200,
    width: 2,
    height: 3
  });

  assert.deepEqual(getTokenGridCenter(largeTarget, { gridSize: 100 }), {
    x: 200,
    y: 350
  });
});

test("builds a centered combat scene from attacker and targets", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100,
    img: "tokens/source.webp"
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100,
    img: "tokens/target.webp"
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    registry: { "Actor.target": "iso/target.webp" }
  });

  assert.equal(scene.tokens.length, 2);
  assert.equal(scene.tokens[0].role, "source");
  assert.equal(scene.tokens[1].role, "target");
  assert.equal(scene.tokens[0].img, "tokens/source.webp");
  assert.equal(scene.tokens[1].img, "iso/target.webp");
  assert.equal(scene.tokens[0].artMode, "token");
  assert.equal(scene.tokens[1].artMode, "iso");
  assert.equal(scene.portraits.source.img, "actors/fallback.webp");
  assert.equal(scene.portraits.targets[0].img, "actors/fallback.webp");
  assert.equal(scene.tokens[1].distance.value, 10);
  assert.equal(scene.grid.lines.length > 0, true);
  assert.equal(scene.grid.lines.some((line) => line.x1 !== line.x2 && line.y1 !== line.y2), true);
  assert.equal(scene.bounds.width > 0, true);
  assert.equal(scene.bounds.height >= 0, true);
});

test("projects large tokens from the center of their occupied grid footprint", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0,
    width: 1,
    height: 1
  });
  const largeTarget = token({
    uuid: "Scene.A.Token.large",
    actorUuid: "Actor.large",
    x: 999,
    y: 999,
    documentX: 100,
    documentY: 0,
    width: 2,
    height: 2
  });

  const scene = buildCombatScene({
    source,
    targets: [largeTarget],
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const sourceSceneToken = scene.tokens.find((entry) => entry.role === "source");
  const targetSceneToken = scene.tokens.find((entry) => entry.role === "target");

  assert.equal(targetSceneToken.size.cells, 2);
  assert.equal(targetSceneToken.sizeScale, 2);
  assert.equal(targetSceneToken.x - sourceSceneToken.x, 50);
  assert.equal(targetSceneToken.y - sourceSceneToken.y, 50);
});

test("centers token anchors inside isometric cells instead of on grid lines", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 200,
    y: 100
  });

  const scene = buildCombatScene({ source, targets: [target] });

  for (const sceneToken of scene.tokens) {
    const nearestLineDistance = Math.min(
      ...scene.grid.lines.map((line) => pointLineDistance(sceneToken, line))
    );
    assert.equal(nearestLineDistance > 10, true);
  }
});

test("uses actor portrait art separately from isometric token art", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100,
    img: "tokens/source.webp"
  });

  assert.equal(getIsoImageForToken(source, {}), "tokens/source.webp");
  assert.equal(getPortraitForToken(source), "actors/fallback.webp");
});

function pointLineDistance(point, line) {
  const numerator = Math.abs(
    ((line.x2 - line.x1) * (line.y1 - point.y))
      - ((line.x1 - point.x) * (line.y2 - line.y1))
  );
  const denominator = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  return denominator > 0 ? numerator / denominator : Infinity;
}

test("measures combat distance with a lightweight grid calculation", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100
  });

  assert.equal(measureTokenDistance(source, target, { gridSize: 100, gridDistance: 5 }).value, 10);
});

test("scales distant encounters so token art stays inside the isometric scene", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const farTarget = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 5100,
    y: 100
  });

  const scene = buildCombatScene({
    source,
    targets: [farTarget],
    size: { width: 560, height: 340 }
  });

  assert.equal(scene.tokens.every((entry) => entry.scale < 1), true);
  assert.equal(scene.tokens.every((entry) => entry.scale >= 0.45), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.left >= 0), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.right <= scene.size.width), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.top >= 0), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.bottom <= scene.size.height), true);
});

test("keeps gargantuan token footprints inside the isometric scene", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0,
    width: 1,
    height: 1
  });
  const gargantuanTarget = token({
    uuid: "Scene.A.Token.gargantuan",
    actorUuid: "Actor.gargantuan",
    x: 999,
    y: 999,
    documentX: 2500,
    documentY: 0,
    width: 4,
    height: 4
  });

  const scene = buildCombatScene({
    source,
    targets: [gargantuanTarget],
    size: { width: 560, height: 340 },
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const target = scene.tokens.find((entry) => entry.role === "target");

  assert.equal(target.size.cells, 4);
  assert.equal(target.sizeScale, 4);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.left >= 0), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.right <= scene.size.width), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.top >= 0), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.bottom <= scene.size.height), true);
});

test("keeps normal-size tokens for close encounters", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 200,
    y: 100
  });

  const scene = buildCombatScene({ source, targets: [target] });

  assert.equal(scene.tokens.every((entry) => entry.scale === 1), true);
});
