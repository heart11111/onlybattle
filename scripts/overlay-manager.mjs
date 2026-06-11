import { buildCombatScene, isVideoMediaPath } from "./core/scene.mjs";
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
import { emitTomitakeBridgeEvent } from "./tomitake-bridge.mjs";
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
      cutins: emptyCutins(),
      cinematicCutin: null,
      isoEffects: []
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
    this.criticalCutins = emptyCutins();
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

    const eventCutins = buildEventCutins(scene, stage);
    const cutins = this.resolveEventCutins(stage, eventCutins);
    const cinematicCutin = buildCinematicCutin(cutins, stage, title);

    await this.app.updateState({
      title,
      scene,
      stage,
      outcome,
      outcomeBadge: outcomeBadge || getOutcomeBadgeKey(stage),
      cutins,
      cinematicCutin,
      isoEffects: [],
      damageType,
      damageEffect
    });
    emitTomitakeBridgeEvent({
      title,
      source: normalizedSource,
      targets: sceneTargets,
      stage,
      outcome,
      outcomeBadge: outcomeBadge || getOutcomeBadgeKey(stage),
      damageType,
      damageSummaries
    });
    this.autoCloseOutcomeStage(stage);
  }

  async showIsoAnimation({ title, source, targets, effects = [] }) {
    const normalizedSource = normalizeToken(source);
    if (!normalizedSource) {
      debug("Skipping isometric animation because no source token was found.");
      return;
    }

    clearTimeout(this.closeTimer);
    this.app ??= new OnlyBattleCombatOverlay();

    const normalizedTargets = uniqueTargets(
      Array.from(targets ?? []).map(normalizeToken).filter(Boolean),
      normalizedSource
    );
    const scene = buildCombatScene({
      source: normalizedSource,
      targets: normalizedTargets,
      registry: getIsometricRegistry()
    });
    const isoEffects = mapIsoEffectsToScene(effects, scene);
    const sceneWithEffects = {
      ...scene,
      isoEffects
    };

    this.lastParticipants = {
      source: normalizedSource,
      targets: normalizedTargets
    };

    await this.app.updateState({
      title,
      scene: sceneWithEffects,
      stage: "animation",
      outcome: "",
      outcomeBadge: "",
      cutins: emptyCutins(),
      cinematicCutin: null,
      isoEffects,
      damageType: "",
      damageEffect: null
    });
    this.autoClose(3200);
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
    this.criticalCutins = emptyCutins();
  }

  autoCloseOutcomeStage(stage) {
    const delay = OUTCOME_CLOSE_DELAYS[stage];
    if (!delay) return;
    this.autoClose(delay);
  }

  resolveEventCutins(stage, eventCutins) {
    if (stage === "critical") {
      this.criticalCutins = eventCutins;
      return eventCutins;
    }

    if (stage === "damage") {
      if (hasCutins(eventCutins)) {
        this.criticalCutins = emptyCutins();
        return eventCutins;
      }
      return hasCutins(this.criticalCutins) ? this.criticalCutins : eventCutins;
    }

    this.criticalCutins = emptyCutins();
    return eventCutins;
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
    return showMidiAttackOutcome(workflow);
  });

  Hooks.on("midi-qol.AttackRollComplete", (workflow) => {
    return showMidiAttackOutcome(workflow);
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

function showMidiAttackOutcome(workflow) {
  if (!shouldAnimateMidiWorkflow(workflow)) return true;
  const outcome = inferMidiAttackOutcome(workflow);
  if (outcome) overlayManager.showFromWorkflow(workflow, outcome);
  return true;
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
    isoEffects: [],
    tokens: scene.tokens.map((token) => ({
      ...token,
      damageEffect: damageEffect && token.role === "target" ? damageEffect : null
    }))
  };
}

function mapIsoEffectsToScene(effects = [], scene) {
  return effects.flatMap((effect) => {
    const source = findSceneToken(scene, effect.sourceId);
    const target = findSceneToken(scene, effect.targetId) ?? source;
    if (!source || !target || !effect.file) return [];

    return [{
      kind: effect.kind,
      file: effect.file,
      mediaType: isVideoMediaPath(effect.file) ? "video" : "image",
      isVideo: isVideoMediaPath(effect.file),
      sourceId: effect.sourceId,
      targetId: effect.targetId,
      source: source.anchor,
      target: target.anchor,
      x: source.anchor.x,
      y: source.anchor.y,
      dx: target.anchor.x - source.anchor.x,
      dy: target.anchor.y - source.anchor.y,
      repeat: effect.repeat ?? 1,
      repeatDelay: effect.repeatDelay ?? 250,
      playbackRate: effect.playbackRate ?? 1,
      label: effect.label ?? "",
      color: effect.color ?? ""
    }];
  });
}

function findSceneToken(scene, id) {
  if (!id) return null;
  return scene.tokens.find((token) => token.id === id
    || token.name === id
    || token.id?.split?.(".").at(-1) === id
    || token.name?.split?.(".").at(-1) === id);
}

function buildEventCutins(scene, stage) {
  if (stage === "critical") {
    return groupCutins([scene?.portraits?.source], "ONLYBATTLE.Overlay.CriticalBang", "criticalCutin");
  }

  if (scene?.unconscious?.length) {
    return groupCutins(scene.unconscious, "ONLYBATTLE.Overlay.UnconsciousBang", "unconsciousCutin");
  }

  if (scene?.bloodied?.length) {
    return groupCutins(scene.bloodied, "ONLYBATTLE.Overlay.BloodiedBang", "bloodiedCutin");
  }

  return emptyCutins();
}

function groupCutins(portraits = [], label, imageKey = "cutin") {
  const cutins = emptyCutins();
  for (const portrait of portraits.filter(Boolean)) {
    const img = portrait[imageKey] || portrait.cutin || portrait.img;
    const entry = {
      ...portrait,
      img,
      isVideo: isVideoMediaPath(img),
      mediaType: isVideoMediaPath(img) ? "video" : "image",
      label
    };
    if (portrait.lane === "enemy") cutins.enemies.push(entry);
    else cutins.allies.push(entry);
  }
  return cutins;
}

function buildCinematicCutin(cutins, stage, title) {
  if (!["critical", "bloodied", "unconscious"].includes(stage) && !hasCutins(cutins)) return null;
  const enemy = cutins?.enemies?.[0];
  const ally = cutins?.allies?.[0];
  const entry = enemy ?? ally;
  if (!entry) return null;
  return {
    ...entry,
    side: enemy ? "enemy" : "ally",
    stage,
    title
  };
}

function emptyCutins() {
  return { allies: [], enemies: [] };
}

function hasCutins(cutins) {
  return Boolean(cutins?.allies?.length || cutins?.enemies?.length);
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
