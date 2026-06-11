import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIsoAnimationRequest,
  classifyAutoAnimationsWorkflow,
  shouldRouteAutoAnimationsWorkflowToIso
} from "../../scripts/compat/autoanimations-bridge.mjs";

test("routes AutoAnimations melee and ranged workflows to the isometric overlay", () => {
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({ menu: "melee" })), true);
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({ menu: "range" })), true);
});

test("routes non-persistent on-token workflows to the isometric overlay", () => {
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({
    menu: "ontoken",
    primary: {
      options: {
        persistent: false
      }
    }
  })), true);
});

test("keeps persistent template and aura workflows on the Foundry canvas", () => {
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({
    menu: "templatefx",
    primary: {
      options: {
        persistent: true,
        persistType: "attachtemplate"
      }
    }
  })), false);
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({ menu: "aura" })), false);
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({ menu: "aefx" })), false);
});

test("routes one-shot projectile-to-template presets like Fireball to the isometric overlay", () => {
  const fireball = workflow({
    menu: "preset",
    presetType: "proToTemp",
    data: {
      projectile: {
        customPath: "modules/jb2a/fireball-beam.webm",
        path: { file: "modules/jb2a/fireball-beam.webm" },
        options: { wait: -1800 }
      },
      explosion: {
        customPath: "modules/jb2a/fireball-explosion.webm",
        path: { file: "modules/jb2a/fireball-explosion.webm" },
        options: { scale: 1.25 }
      },
      afterImage: {
        enable: false,
        options: {
          persistent: false
        }
      }
    }
  });

  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(fireball), true);
  assert.equal(classifyAutoAnimationsWorkflow(fireball), "projectile-template");
});

test("keeps projectile-to-template presets with persistent afterimages on the Foundry canvas", () => {
  assert.equal(shouldRouteAutoAnimationsWorkflowToIso(workflow({
    menu: "preset",
    presetType: "proToTemp",
    data: {
      afterImage: {
        enable: true,
        options: {
          persistent: true
        }
      }
    }
  })), false);
});

test("builds lightweight isometric effect requests from AutoAnimations data", () => {
  const source = token("source");
  const target = token("target");
  const request = buildIsoAnimationRequest({
    clonedData: {
      item: { name: "Fire Bolt" },
      token: source,
      targets: [target],
      hitTargets: [target]
    },
    animationData: workflow({
      menu: "range",
      primary: {
        video: { animation: "firebolt", color: "orange" },
        path: { file: "modules/jb2a/firebolt.webm" },
        options: {
          repeat: 1,
          repeatDelay: 250,
          playbackRate: 1
        }
      }
    })
  });

  assert.deepEqual(request, {
    title: "Fire Bolt",
    source,
    targets: [target],
    effects: [{
      kind: "projectile",
      file: "modules/jb2a/firebolt.webm",
      sourceId: "source",
      targetId: "target",
      repeat: 1,
      repeatDelay: 250,
      playbackRate: 1,
      label: "firebolt",
      color: "orange"
    }]
  });
});

test("resolves raw AutoAnimations database entries through Sequencer before routing to DOM media", () => {
  const previousSequencer = globalThis.Sequencer;
  globalThis.Sequencer = {
    Database: {
      getEntry: (databasePath, options) => {
        assert.equal(databasePath, "autoanimations.range.spell.firebolt.01.orange");
        assert.deepEqual(options, { softFail: true });
        return { file: "modules/JB2A_DnD5e/Library/Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_30ft_1600x400.webm" };
      }
    }
  };

  try {
    const source = token("source");
    const target = token("target");
    const request = buildIsoAnimationRequest({
      clonedData: {
        item: { name: "Fire Bolt" },
        token: source,
        targets: [target]
      },
      animationData: workflow({
        menu: "range",
        primary: {
          video: {
            dbSection: "range",
            menuType: "spell",
            animation: "firebolt",
            variant: "01",
            color: "orange"
          },
          options: {}
        }
      })
    });

    assert.equal(request.effects.length, 1);
    assert.equal(
      request.effects[0].file,
      "modules/JB2A_DnD5e/Library/Cantrip/Fire_Bolt/FireBolt_01_Regular_Orange_30ft_1600x400.webm"
    );
  } finally {
    globalThis.Sequencer = previousSequencer;
  }
});

test("does not stop the original AutoAnimations workflow when raw database entries cannot be resolved", async () => {
  const previousSequencer = globalThis.Sequencer;
  const calls = [];
  const data = {
    item: { name: "Fire Bolt" },
    token: token("source"),
    targets: [token("target")]
  };

  delete globalThis.Sequencer;
  globalThis.Hooks = {
    on: (name, callback) => {
      calls.push({ name, callback });
      return calls.length;
    }
  };
  globalThis.game = {
    settings: {
      get: (moduleId, key) => moduleId === "onlybattle" && key === "enableAutoAnimationsBridge"
    }
  };

  try {
    const { registerAutoAnimationsBridge } = await import(`../../scripts/compat/autoanimations-bridge.mjs?unresolved=${Date.now()}`);
    const shown = [];
    registerAutoAnimationsBridge({
      showIsoAnimation: (request) => shown.push(request)
    });

    const hook = calls.find((entry) => entry.name === "AutomatedAnimations-WorkflowStart").callback;
    hook(data, workflow({
      menu: "range",
      primary: {
        video: {
          dbSection: "range",
          menuType: "spell",
          animation: "firebolt",
          variant: "01",
          color: "orange"
        }
      }
    }));

    assert.equal(data.stopWorkflow, undefined);
    assert.equal(shown.length, 0);
  } finally {
    globalThis.Sequencer = previousSequencer;
  }
});

test("AutoAnimations bridge stops only routeable workflows and leaves persistent canvas effects alone", async () => {
  const calls = [];
  const instantData = {
    item: { name: "Longsword" },
    token: token("source"),
    targets: [token("target")]
  };
  const persistentData = {
    item: { name: "Moonbeam" },
    token: token("source"),
    targets: [token("target")]
  };

  globalThis.Hooks = {
    on: (name, callback) => {
      calls.push({ name, callback });
      return calls.length;
    }
  };
  globalThis.game = {
    settings: {
      get: (moduleId, key) => moduleId === "onlybattle" && key === "enableAutoAnimationsBridge"
    }
  };

  const { registerAutoAnimationsBridge } = await import(`../../scripts/compat/autoanimations-bridge.mjs?bridge=${Date.now()}`);
  const shown = [];
  registerAutoAnimationsBridge({
    showIsoAnimation: (request) => shown.push(request)
  });

  const hook = calls.find((entry) => entry.name === "AutomatedAnimations-WorkflowStart").callback;
  hook(instantData, workflow({ menu: "melee", primary: { path: { file: "modules/jb2a/sword.webm" } } }));
  hook(persistentData, workflow({
    menu: "templatefx",
    primary: { options: { persistent: true, persistType: "attachtemplate" } }
  }));

  assert.equal(instantData.stopWorkflow, true);
  assert.equal(persistentData.stopWorkflow, undefined);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Longsword");
});

function workflow(data) {
  return data;
}

function token(id) {
  return {
    id,
    name: id,
    document: { uuid: `Scene.A.Token.${id}` }
  };
}
