import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCombatScene,
  getCutinImageForToken,
  getIsoImageForToken,
  getPortraitForToken,
  getTokenGridCenter,
  isVideoMediaPath,
  measureTokenDistance,
  projectCanvasToIso
} from "../scripts/core/scene.mjs";

function token({ uuid, actorUuid, x, y, img = "tokens/default.webp", documentX, documentY, width = 1, height = 1, disposition = 0, elevation = 0 }) {
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
      height,
      disposition,
      elevation
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

test("keeps cut-in image paths as lightweight strings on scene portraits", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });
  source.actor.getFlag = (moduleId, key) => moduleId === "onlybattle" && key === "images"
    ? {
        cutin: "actors/source-cutin.webp",
        criticalCutin: "actors/source-critical.webm",
        bloodiedCutin: "actors/source-bloodied.webp"
      }
    : undefined;

  const scene = buildCombatScene({ source });

  assert.equal(getCutinImageForToken(source, {}, "criticalCutin"), "actors/source-critical.webm");
  assert.equal(scene.portraits.source.cutin, "actors/source-cutin.webp");
  assert.equal(scene.portraits.source.criticalCutin, "actors/source-critical.webm");
  assert.equal(scene.portraits.source.bloodiedCutin, "actors/source-bloodied.webp");
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

test("snaps slightly off-grid token documents to the occupied grid cell center", () => {
  const gridApi = {
    size: 100,
    getSnappedPoint(point, { mode }) {
      assert.equal(mode, 0x100);
      return {
        x: Math.round(point.x / 100) * 100,
        y: Math.round(point.y / 100) * 100
      };
    }
  };
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 103,
    documentY: 98,
    width: 1,
    height: 1
  });

  assert.deepEqual(getTokenGridCenter(source, { gridSize: 100, api: gridApi }), {
    x: 150,
    y: 150
  });
});

test("uses Foundry grid center points as the source of token footprint centers", () => {
  let getCenterPointCalled = false;
  const gridApi = {
    size: 100,
    getCenterPoint(point) {
      getCenterPointCalled = true;
      assert.deepEqual(point, { x: 103, y: 98 });
      return { x: 150, y: 150 };
    },
    getSnappedPoint() {
      return { x: 0, y: 0 };
    }
  };
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 103,
    documentY: 98,
    width: 2,
    height: 3
  });

  assert.deepEqual(getTokenGridCenter(source, { gridSize: 100, api: gridApi }), {
    x: 200,
    y: 250
  });
  assert.equal(getCenterPointCalled, true);
});

test("uses Foundry grid measurement when available for displayed combat distance", () => {
  let measurePathCalled = false;
  const gridApi = {
    size: 100,
    getSnappedPoint(point) {
      return {
        x: Math.round(point.x / 100) * 100,
        y: Math.round(point.y / 100) * 100
      };
    },
    measurePath(points) {
      measurePathCalled = true;
      return {
        distance: Math.max(
          Math.abs(points[1].x - points[0].x),
          Math.abs(points[1].y - points[0].y)
        ) / 100 * 5
      };
    }
  };
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 103,
    documentY: 98
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 233,
    documentY: 97
  });

  assert.equal(measureTokenDistance(source, target, { gridSize: 100, gridDistance: 5, api: gridApi }).value, 5);
  assert.equal(measurePathCalled, true);
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
  assert.equal(scene.tokens[0].tokenArtHeight, 46);
  assert.equal(scene.tokens[1].tokenArtHeight, 76);
  assert.equal(scene.portraits.source.img, "actors/fallback.webp");
  assert.equal(scene.portraits.targets[0].img, "actors/fallback.webp");
  assert.equal(scene.tokens[1].distance.value, 10);
  assert.equal(scene.grid.cells.length > 0, true);
  assert.equal(scene.grid.cells.every((cell) => cell.points.split(" ").length === 4), true);
  assert.equal(scene.bounds.width > 0, true);
  assert.equal(scene.bounds.height >= 0, true);
});

test("marks webm isometric token art as looping video media", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100
  });

  const scene = buildCombatScene({
    source,
    registry: {
      "Actor.source": "onlybattle/tokens/source.webm"
    }
  });

  assert.equal(isVideoMediaPath("onlybattle/tokens/source.webm?cache=1"), true);
  assert.equal(isVideoMediaPath("onlybattle/tokens/source.webp"), false);
  assert.equal(scene.tokens[0].isVideo, true);
  assert.equal(scene.tokens[0].mediaType, "video");
});

test("marks normal Foundry token webm fallback as looping video media", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100,
    img: "tokens/source.webm"
  });

  const scene = buildCombatScene({ source });

  assert.equal(scene.tokens[0].img, "tokens/source.webm");
  assert.equal(scene.tokens[0].artMode, "token");
  assert.equal(scene.tokens[0].isVideo, true);
  assert.equal(scene.tokens[0].mediaType, "video");
});

test("groups cut-in portraits by token disposition instead of roller role", () => {
  const hostileSource = token({
    uuid: "Scene.A.Token.enemy",
    actorUuid: "Actor.enemy",
    x: 100,
    y: 100,
    disposition: -1
  });
  const friendlyTarget = token({
    uuid: "Scene.A.Token.ally",
    actorUuid: "Actor.ally",
    x: 300,
    y: 100,
    disposition: 1
  });

  const scene = buildCombatScene({
    source: hostileSource,
    targets: [friendlyTarget]
  });

  assert.deepEqual(scene.portraits.enemies.map((portrait) => portrait.id), ["Scene.A.Token.enemy"]);
  assert.deepEqual(scene.portraits.allies.map((portrait) => portrait.id), ["Scene.A.Token.ally"]);
});

test("adds damage and bloodied annotations to matching scene portraits", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100,
    disposition: 1
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100,
    disposition: -1
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    damageSummaries: [{
      tokenUuid: "Scene.A.Token.target",
      actorUuid: "Actor.target",
      damageText: "-8",
      hpText: "12 HP",
      bloodied: true
    }]
  });
  const targetPortrait = scene.portraits.enemies[0];

  assert.equal(targetPortrait.damageText, "-8");
  assert.equal(targetPortrait.hpText, "12 HP");
  assert.equal(targetPortrait.bloodied, true);
  assert.equal(scene.bloodied.length, 1);
});

test("adds unconscious annotations to matching scene portraits", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 100,
    y: 100,
    disposition: 1
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 300,
    y: 100,
    disposition: -1
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    damageSummaries: [{
      tokenUuid: "Scene.A.Token.target",
      actorUuid: "Actor.target",
      damageText: "-18",
      hpText: "0 HP",
      unconscious: true
    }]
  });
  const targetPortrait = scene.portraits.enemies[0];

  assert.equal(targetPortrait.damageText, "-18");
  assert.equal(targetPortrait.hpText, "0 HP");
  assert.equal(targetPortrait.unconscious, true);
  assert.equal(scene.unconscious.length, 1);
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
  const gridCellPoints = new Set(scene.grid.cells.map((cell) => cell.points));

  for (const sceneToken of scene.tokens) {
    assert.deepEqual(sceneToken.anchor, sceneToken.floor);
    assert.equal(sceneToken.footprintCells.length, 1);
    assert.deepEqual(diamondCenter(sceneToken.footprintCells[0].points), sceneToken.floor);
    assert.equal(gridCellPoints.has(sceneToken.footprintCells[0].points), true);
  }
});

test("keeps token anchors centered when the canvas grid size is not 100px", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 50,
    documentY: 0
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    grid: { gridSize: 50, gridDistance: 5 }
  });

  assert.equal(scene.grid.stepX, 50);
  const gridCellPoints = new Set(scene.grid.cells.map((cell) => cell.points));
  for (const sceneToken of scene.tokens) {
    assert.deepEqual(sceneToken.anchor, sceneToken.floor);
    assert.equal(sceneToken.footprintCells.length, 1);
    assert.deepEqual(diamondCenter(sceneToken.footprintCells[0].points), sceneToken.floor);
    assert.equal(gridCellPoints.has(sceneToken.footprintCells[0].points), true);
  }
});

test("normalizes isometric scene geometry across different map grid pixel sizes", () => {
  const smallGridSource = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const smallGridTarget = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 50,
    documentY: 0
  });
  const largeGridSource = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const largeGridTarget = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 150,
    documentY: 0
  });

  const smallGridScene = buildCombatScene({
    source: smallGridSource,
    targets: [smallGridTarget],
    grid: { gridSize: 50, gridDistance: 5 }
  });
  const largeGridScene = buildCombatScene({
    source: largeGridSource,
    targets: [largeGridTarget],
    grid: { gridSize: 150, gridDistance: 5 }
  });
  const smallTarget = smallGridScene.tokens.find((entry) => entry.role === "target");
  const largeTarget = largeGridScene.tokens.find((entry) => entry.role === "target");
  const smallSource = smallGridScene.tokens.find((entry) => entry.role === "source");
  const largeSource = largeGridScene.tokens.find((entry) => entry.role === "source");

  assert.equal(smallGridScene.grid.stepX, 50);
  assert.equal(largeGridScene.grid.stepX, 50);
  assert.equal(smallTarget.x - smallSource.x, largeTarget.x - largeSource.x);
  assert.equal(smallTarget.y - smallSource.y, largeTarget.y - largeSource.y);
  assert.equal(smallTarget.scale, largeTarget.scale);
});

test("colors every occupied floor cell by ally and enemy disposition", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0,
    disposition: 1
  });
  const largeTarget = token({
    uuid: "Scene.A.Token.large",
    actorUuid: "Actor.large",
    x: 999,
    y: 999,
    documentX: 100,
    documentY: 0,
    width: 2,
    height: 2,
    disposition: -1
  });

  const scene = buildCombatScene({
    source,
    targets: [largeTarget],
    grid: { gridSize: 100, gridDistance: 5 }
  });

  assert.equal(scene.floorCells.filter((cell) => cell.lane === "ally").length, 1);
  assert.equal(scene.floorCells.filter((cell) => cell.lane === "enemy").length, 4);
  assert.equal(scene.floorCells.every((cell) => cell.points.split(" ").length === 4), true);
});

test("centers normal token anchors on their occupied floor cell", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });

  const scene = buildCombatScene({
    source,
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const sceneToken = scene.tokens[0];
  const floorCell = scene.floorCells[0];

  assert.equal(sceneToken.x, sceneToken.floorX);
  assert.equal(sceneToken.y, sceneToken.floorY);
  assert.deepEqual(diamondCenter(floorCell.points), {
    x: sceneToken.floorX,
    y: sceneToken.floorY
  });
});

test("uses scene-space anchor, floor, and footprint cells as the single render coordinate source", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0,
    elevation: 10
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

  assert.deepEqual(sourceSceneToken.anchor, { x: sourceSceneToken.x, y: sourceSceneToken.y });
  assert.deepEqual(sourceSceneToken.floor, { x: sourceSceneToken.floorX, y: sourceSceneToken.floorY });
  assert.equal(sourceSceneToken.anchor.y < sourceSceneToken.floor.y, true);
  assert.equal(sourceSceneToken.footprintCells.length, 1);
  assert.deepEqual(diamondCenter(sourceSceneToken.footprintCells[0].points), sourceSceneToken.floor);

  assert.deepEqual(targetSceneToken.anchor, { x: targetSceneToken.x, y: targetSceneToken.y });
  assert.deepEqual(targetSceneToken.floor, { x: targetSceneToken.floorX, y: targetSceneToken.floorY });
  assert.equal(targetSceneToken.footprintCells.length, 4);
  assert.deepEqual(scene.floorCells.filter((cell) => cell.tokenId === targetSceneToken.id), targetSceneToken.footprintCells);
});

test("uses the exact rendered grid cell polygons for occupied floor cells", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 100,
    documentY: 0
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const gridCellPoints = new Set(scene.grid.cells.map((cell) => cell.points));

  for (const cell of scene.floorCells) {
    assert.equal(gridCellPoints.has(cell.points), true);
  }
});

test("builds the isometric plane from the same rendered grid cell bounds", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 100,
    documentY: 0
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const clipPoints = parsePolygon(scene.grid.clipPoints);
  const gridPoints = scene.grid.cells.flatMap((cell) => parsePolygon(cell.points));
  const minX = Math.min(...gridPoints.map((point) => point.x));
  const maxX = Math.max(...gridPoints.map((point) => point.x));
  const minY = Math.min(...gridPoints.map((point) => point.y));
  const maxY = Math.max(...gridPoints.map((point) => point.y));

  assert.equal(clipPoints.some((point) => point.x === minX), true);
  assert.equal(clipPoints.some((point) => point.x === maxX), true);
  assert.equal(clipPoints.some((point) => point.y === minY), true);
  assert.equal(clipPoints.some((point) => point.y === maxY), true);
});

test("keeps scaled distant floor cells on the same grid lattice", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 900,
    documentY: 600
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    grid: { gridSize: 100, gridDistance: 5 }
  });

  assert.equal(scene.zoom < 1, true);
  const gridCellPoints = new Set(scene.grid.cells.map((cell) => cell.points));
  for (const cell of scene.floorCells) {
    assert.equal(gridCellPoints.has(cell.points), true);
  }
});

test("keeps auto-scaled occupied cells on the exact same grid basis", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 1200,
    documentY: -500
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    grid: { gridSize: 100, gridDistance: 5 }
  });
  assert.equal(scene.zoom < 1, true);
  for (const cell of scene.floorCells) {
    for (const point of parsePolygon(cell.points)) {
      assert.equal(gridBasisResidual(point, {
        origin: scene.grid.origin,
        stepX: scene.grid.stepX,
        stepY: scene.grid.stepY
      }) < 0.001, true);
    }
  }
});

test("keeps every rendered floor cell inside the scene padding after distant fit", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });
  const target = token({
    uuid: "Scene.A.Token.target",
    actorUuid: "Actor.target",
    x: 999,
    y: 999,
    documentX: 1200,
    documentY: -500
  });

  const scene = buildCombatScene({
    source,
    targets: [target],
    size: { width: 560, height: 340 },
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const floorPoints = scene.floorCells.flatMap((cell) => parsePolygon(cell.points));
  const gridCellPoints = new Set(scene.grid.cells.map((cell) => cell.points));

  assert.equal(floorPoints.every((point) => point.x >= 18), true);
  assert.equal(floorPoints.every((point) => point.x <= scene.size.width - 18), true);
  assert.equal(floorPoints.every((point) => point.y >= 18), true);
  assert.equal(floorPoints.every((point) => point.y <= scene.size.height - 18), true);
  assert.equal(scene.floorCells.every((cell) => gridCellPoints.has(cell.points)), true);
});

test("keeps fallback token art unboxed while anchoring it to the isometric cell center", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0
  });

  const scene = buildCombatScene({
    source,
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const sceneToken = scene.tokens[0];

  assert.equal("tokenStandWidth" in sceneToken, false);
  assert.equal("tokenStandHeight" in sceneToken, false);
  assert.deepEqual(sceneToken.anchor, sceneToken.floor);
  assert.equal(sceneToken.tokenArtHeight, 46);
  assert.equal(Number.isFinite(sceneToken.labelTop), true);
});

test("raises flying tokens and connects them back to their occupied floor", () => {
  const source = token({
    uuid: "Scene.A.Token.source",
    actorUuid: "Actor.source",
    x: 999,
    y: 999,
    documentX: 0,
    documentY: 0,
    elevation: 30
  });

  const scene = buildCombatScene({
    source,
    grid: { gridSize: 100, gridDistance: 5 }
  });
  const sceneToken = scene.tokens[0];

  assert.equal(sceneToken.elevation, 30);
  assert.equal(sceneToken.y < sceneToken.floorY, true);
  assert.equal(scene.flightLines.length, 1);
  assert.equal(scene.flightLines[0].tokenId, "Scene.A.Token.source");
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

function gridBasisResidual(point, { origin, stepX, stepY }) {
  const x = Number(point.x ?? 0) - Number(origin.x ?? 0);
  const y = Number(point.y ?? 0) - Number(origin.y ?? 0);
  const u = ((y / stepY) + (x / stepX)) / 2;
  const v = ((y / stepY) - (x / stepX)) / 2;
  return Math.max(Math.abs(u - Math.round(u)), Math.abs(v - Math.round(v)));
}

function diamondCenter(points) {
  const parsed = points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
  return {
    x: (parsed[1].x + parsed[3].x) / 2,
    y: (parsed[0].y + parsed[2].y) / 2
  };
}

function parsePolygon(points) {
  return points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x);
    if (intersects) inside = !inside;
  }
  return inside || polygon.some((vertex) => Math.abs(vertex.x - point.x) <= 1 && Math.abs(vertex.y - point.y) <= 1);
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
  assert.equal(scene.tokens.every((entry) => entry.scale >= 0.28), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.left >= 0), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.right <= scene.size.width), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.top >= 0), true);
  assert.equal(scene.tokens.every((entry) => entry.visualBounds.bottom <= scene.size.height), true);
  assert.equal(scene.tokens.every((entry) => pointInPolygon(
    { x: entry.floorX, y: entry.floorY },
    parsePolygon(scene.grid.clipPoints)
  )), true);
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
