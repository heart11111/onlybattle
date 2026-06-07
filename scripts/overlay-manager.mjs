import { buildCombatScene } from "./core/scene.mjs";
import { getDamageEffect } from "./core/damage-effects.mjs";
import { getOutcomeBadgeKey, getOutcomeState } from "./core/outcome.mjs";
import {
  shouldAnimateDamageWorkflow,
  shouldAnimateMidiWorkflow
} from "./core/workflow-filter.mjs";
import {
  inferDamageType,
  inferMidiAttackOutcome,
  workflowDamageSummaries,
  workflowTargets,
  workflowTitle
} from "./core/workflow-view.mjs";
import { getIsometricRegistry } from "./settings.mjs";
import { debug } from "./logger.mjs";

const OUTCOME_CLOSE_DELAYS = {
  attack: 6500,
  miss: 1400,
  hit: 4200,
  critical: 4400
};

class OnlyBattleCombatOverlay extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "onlybattle-combat-overlay",
    classes: ["onlybattle", "onlybattle-combat-overlay"],
    window: {
      frame: false,
      positioned: false
    },
    position: {
      width: 860,
      height: 430
    }
  };

  static PARTS = {
    main: {
      template: "modules/onlybattle/templates/combat-overlay.hbs"
    }
  };

  constructor() {
    super();
    this.viewState = {
      title: "",
      stage: "attack",
      scene: buildCombatScene({}),
      damageType: "",
      damageEffect: null,
      outcome: "",
      outcomeBadge: "",
      cutins: emptyCutins()
    };
  }

  updateState(nextState) {
    this.viewState = foundry.utils.mergeObject(this.viewState, nextState, { inplace: false });
    return this.render({ force: true });
  }

  async _prepareContext(options) {
    return {
      ...(await super._prepareContext(options)),
      ...this.viewState
    };
  }
}

class OverlayManager {
  constructor() {
    this.app = null;
    this.closeTimer = null;
    this.lastParticipants = null;
  }

  async showFromActivity(activity, {
    stage = "attack",
    outcome = "",
    outcomeBadge = "",
    damageType = "",
    targetTokens = null,
    damageSummaries = []
  } = {}) {
    const source = resolveSourceToken(activity?.actor ?? activity?.item?.actor);
    const targets = targetTokens ? Array.from(targetTokens) : Array.from(game.user?.targets ?? []);
    return this.show({
      title: activity?.item?.name ?? activity?.name ?? "",
      source,
      targets,
      stage,
      outcome,
      outcomeBadge,
      damageType,
      damageSummaries
    });
  }

  async showFromWorkflow(workflow, {
    stage = "attack",
    outcome = "",
    outcomeBadge = "",
    damageType = ""
  } = {}) {
    const source = normalizeToken(workflow?.token) ?? resolveSourceToken(workflow?.actor ?? workflow?.item?.actor);
    const targets = workflowTargets(workflow, stage);
    const damageSummaries = stage === "damage" ? workflowDamageSummaries(workflow, targets) : [];
    return this.show({
      title: workflowTitle(workflow),
      source,
      targets,
      stage,
      outcome,
      outcomeBadge,
      damageType: damageType || inferDamageType(workflow),
      damageSummaries
    });
  }

  async show({ title, source, targets, stage, outcome, outcomeBadge, damageType, damageSummaries = [] }) {
    const normalizedSource = normalizeToken(source);
    if (!normalizedSource) {
      debug("Skipping overlay because no source token was found.");
      return;
    }

    clearTimeout(this.closeTimer);
    this.app ??= new OnlyBattleCombatOverlay();
    const normalizedTargets = uniqueTargets(
      Array.from(targets ?? []).map(normalizeToken).filter(Boolean),
      normalizedSource
    );
    const rememberedTargets = sameToken(normalizedSource, this.lastParticipants?.source)
      ? uniqueTargets(this.lastParticipants.targets, normalizedSource)
      : [];
    const sceneTargets = normalizedTargets.length ? normalizedTargets : rememberedTargets;
    this.lastParticipants = {
      source: normalizedSource,
      targets: sceneTargets
    };

    const damageEffect = stage === "damage" ? getDamageEffect(damageType) : null;
    const scene = withDamageEffects(buildCombatScene({
      source: normalizedSource,
      targets: sceneTargets,
      registry: getIsometricRegistry(),
      damageSummaries
    }), damageEffect);

    await this.app.updateState({
      title,
      scene,
      stage,
      outcome,
      outcomeBadge: outcomeBadge || getOutcomeBadgeKey(stage),
      cutins: buildEventCutins(scene, stage),
      damageType,
      damageEffect
    });
    this.autoCloseOutcomeStage(stage);
  }

  autoClose(delay = 1800) {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.close();
    }, delay);
  }

  close() {
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
    this.app?.close();
    this.app = null;
    this.lastParticipants = null;
  }

  autoCloseOutcomeStage(stage) {
    const delay = OUTCOME_CLOSE_DELAYS[stage];
    if (!delay) return;
    this.autoClose(delay);
  }
}

const overlayManager = new OverlayManager();

export function getOverlayManager() {
  return overlayManager;
}

export function registerMidiOverlayHooks() {
  Hooks.on("midi-qol.preAttackRoll", (workflow) => {
    if (!shouldAnimateMidiWorkflow(workflow)) return true;
    overlayManager.showFromWorkflow(workflow, { stage: "attack" });
    return true;
  });

  Hooks.on("midi-qol.postAttackRoll", (workflow) => {
    if (!shouldAnimateMidiWorkflow(workflow)) return true;
    const outcome = inferMidiAttackOutcome(workflow);
    if (outcome) overlayManager.showFromWorkflow(workflow, outcome);
    return true;
  });

  Hooks.on("midi-qol.postDamageRoll", (workflow) => {
    if (!shouldAnimateDamageWorkflow(workflow)) return true;
    overlayManager.showFromWorkflow(workflow, getOutcomeState("damage"));
    overlayManager.autoClose();
    return true;
  });

  Hooks.on("midi-qol.isDamaged", (workflow) => {
    if (!shouldAnimateDamageWorkflow(workflow)) return true;
    overlayManager.showFromWorkflow(workflow, getOutcomeState("damage"));
    overlayManager.autoClose();
    return true;
  });

  Hooks.on("midi-qol.RollComplete", (workflow) => {
    if (workflow && !shouldAnimateMidiWorkflow(workflow)) return true;
    overlayManager.autoClose(900);
    return true;
  });
}

function resolveSourceToken(actor) {
  if (!actor) return null;
  return canvas.tokens?.controlled?.find((token) => token.actor === actor)
    ?? actor.getActiveTokens?.()[0]
    ?? null;
}

function withDamageEffects(scene, damageEffect) {
  return {
    ...scene,
    tokens: scene.tokens.map((token) => ({
      ...token,
      damageEffect: damageEffect && token.role === "target" ? damageEffect : null
    }))
  };
}

function buildEventCutins(scene, stage) {
  if (stage === "critical") {
    return groupCutins([scene?.portraits?.source], "ONLYBATTLE.Overlay.CriticalBang");
  }

  if (scene?.bloodied?.length) {
    return groupCutins(scene.bloodied, "ONLYBATTLE.Overlay.BloodiedBang");
  }

  return emptyCutins();
}

function groupCutins(portraits = [], label) {
  const cutins = emptyCutins();
  for (const portrait of portraits.filter(Boolean)) {
    const entry = { ...portrait, label };
    if (portrait.lane === "enemy") cutins.enemies.push(entry);
    else cutins.allies.push(entry);
  }
  return cutins;
}

function emptyCutins() {
  return { allies: [], enemies: [] };
}

function normalizeToken(token) {
  return token?.object ?? token;
}

function sameToken(a, b) {
  if (!a || !b) return false;
  return (a.document?.uuid && a.document.uuid === b.document?.uuid)
    || (a.id && a.id === b.id);
}

function uniqueTargets(tokens, source) {
  const seen = new Set();
  const targets = [];

  for (const token of tokens) {
    if (!token || sameToken(token, source)) continue;
    const key = tokenKey(token);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(token);
  }

  return targets;
}

function tokenKey(token) {
  return token?.document?.uuid
    ?? token?.id
    ?? token?.name
    ?? token;
}
