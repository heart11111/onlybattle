import test from "node:test";
import assert from "node:assert/strict";

import {
  activateCanvasTargetTool,
  captureCanvasToolState,
  restoreCanvasToolState
} from "../scripts/core/canvas-controls.mjs";

test("captures the active canvas control and tool before targeting", () => {
  const controls = {
    active: {
      control: "tokens",
      tool: "select"
    }
  };

  assert.deepEqual(captureCanvasToolState(controls), {
    control: "tokens",
    tool: "select"
  });
});

test("activates the token target tool and returns the previous tool state", async () => {
  const activations = [];
  const tokenLayer = {
    active: false,
    async activate() {
      this.active = true;
    }
  };
  const controls = {
    active: {
      control: "tokens",
      tool: "select"
    },
    controls: {
      tokens: {
        name: "tokens",
        tools: {
          select: { name: "select" },
          target: { name: "target" }
        }
      }
    },
    async activate(toolState) {
      activations.push(toolState);
    }
  };

  const previous = await activateCanvasTargetTool({ controls, tokenLayer });

  assert.equal(tokenLayer.active, true);
  assert.deepEqual(previous, { control: "tokens", tool: "select" });
  assert.deepEqual(activations, [{ control: "tokens", tool: "target" }]);
});

test("restores the previous canvas tool after OnlyBattle targeting closes", async () => {
  const activations = [];
  const controls = {
    async activate(toolState) {
      activations.push(toolState);
    }
  };

  const restored = await restoreCanvasToolState({ control: "tokens", tool: "select" }, { controls });

  assert.equal(restored, true);
  assert.deepEqual(activations, [{ control: "tokens", tool: "select" }]);
});

test("falls back to the token select tool when the previous tool state is unavailable", async () => {
  const activations = [];
  const controls = {
    controls: {
      tokens: {
        name: "tokens",
        tools: {
          select: { name: "select" }
        }
      }
    },
    async activate(toolState) {
      activations.push(toolState);
    }
  };

  const restored = await restoreCanvasToolState(null, { controls });

  assert.equal(restored, true);
  assert.deepEqual(activations, [{ control: "tokens", tool: "select" }]);
});
