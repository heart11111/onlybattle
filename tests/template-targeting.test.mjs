import test from "node:test";
import assert from "node:assert/strict";

import {
  deletePlacedTemplates,
  tokensInsideTemplates
} from "../scripts/core/template-targeting.mjs";

test("selects every token whose center is inside a measured template", () => {
  const template = {
    document: { x: 100, y: 100 },
    shape: {
      contains: (x, y) => x >= 0 && x <= 100 && y >= 0 && y <= 100
    }
  };
  const inside = { id: "inside", center: { x: 140, y: 150 } };
  const outside = { id: "outside", center: { x: 240, y: 150 } };

  assert.deepEqual(tokensInsideTemplates([template], [inside, outside]), [inside]);
});

test("deduplicates tokens caught by overlapping templates", () => {
  const template = {
    document: { x: 0, y: 0 },
    shape: {
      contains: (x, y) => x >= 0 && x <= 100 && y >= 0 && y <= 100
    }
  };
  const token = { id: "token", center: { x: 50, y: 50 } };

  assert.deepEqual(tokensInsideTemplates([template, template], [token]), [token]);
});

test("falls back to token document dimensions when center is not available", () => {
  const template = {
    document: { x: 10, y: 20 },
    shape: {
      contains: (x, y) => x === 25 && y === 25
    }
  };
  const token = {
    id: "document-center",
    document: { x: 30, y: 40, width: 1, height: 1 }
  };
  const canvasGrid = { size: 10 };

  assert.deepEqual(tokensInsideTemplates([template], [token], { grid: canvasGrid }), [token]);
});

test("deletes placed template documents when targeting is cancelled", async () => {
  const deleted = [];
  const document = {
    uuid: "Scene.A.MeasuredTemplate.1",
    delete: async () => deleted.push("deleted")
  };

  await deletePlacedTemplates([{ document }]);

  assert.deepEqual(deleted, ["deleted"]);
});
