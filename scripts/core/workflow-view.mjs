import { firstNonEmptyCollection } from "./collections.mjs";
import { getOutcomeState, inferAttackOutcome } from "./outcome.mjs";

export function workflowTitle(workflow) {
  return workflow?.item?.name
    ?? workflow?.activity?.item?.name
    ?? workflow?.activity?.name
    ?? "";
}

export function workflowTargets(workflow, stage, fallbackTargets = globalThis.game?.user?.targets ?? []) {
  const preferred = stage === "damage"
    ? firstNonEmptyCollection(workflow?.hitTargets, workflow?.failedSaves, workflow?.targets, workflow?.saves)
    : firstNonEmptyCollection(workflow?.targets, workflow?.hitTargets);
  return Array.from(preferred ?? fallbackTargets ?? []);
}

export function workflowDamageSummaries(workflow, tokens = workflowTargets(workflow, "damage", []), midiConfig = midiConfigSettings()) {
  const damageItems = Array.from(workflow?.damageList ?? []);
  if (!damageItems.length) return [];

  return damageItems.map((damageItem) => {
    const token = matchingDamageToken(damageItem, tokens);
    const numbersVisible = shouldShowDamageNumbers(token, midiConfig);
    const bloodied = shouldShowBloodiedCutin(damageItem, token, midiConfig);
    const unconscious = shouldShowUnconsciousCutin(damageItem, token, midiConfig);
    const damageText = numbersVisible ? formatDamageText(damageItem) : "";
    const hpText = numbersVisible ? formatRemainingHp(damageItem) : "";

    if (!damageText && !hpText && !bloodied && !unconscious) return null;

    return {
      tokenUuid: damageItem.targetUuid ?? token?.document?.uuid ?? "",
      actorUuid: damageItem.actorUuid ?? token?.actor?.uuid ?? "",
      damageText,
      hpText,
      bloodied,
      ...(unconscious ? { unconscious } : {})
    };
  }).filter(Boolean);
}

export function shouldShowDamageNumbers(token, midiConfig = midiConfigSettings()) {
  if (globalThis.game?.user?.isGM) return true;

  const playerDamageCard = midiConfig?.playerDamageCard ?? "none";
  if (playerDamageCard === "none") return false;
  if (!token) return playerDamageCard === "npcplayerresults" || playerDamageCard === "npcplayerbuttons";

  const isNpc = token?.actor?.hasPlayerOwner === false;
  if (isNpc) return playerDamageCard === "npcplayerresults" || playerDamageCard === "npcplayerbuttons";

  return true;
}

export function shouldShowBloodiedCutin(damageItem, token, midiConfig = midiConfigSettings()) {
  const threshold = Number(midiConfig?.addWounded);
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  if ((midiConfig?.addWoundedStyle ?? "none") === "none") return false;
  if (!midiConfig?.midiWoundedCondition || midiConfig.midiWoundedCondition === "none") return false;

  const maxHp = Number(token?.actor?.system?.attributes?.hp?.max ?? damageItem?.maxHP);
  const oldHp = Number(damageItem?.oldHP);
  const newHp = Number(damageItem?.newHP);
  if (![maxHp, oldHp, newHp].every(Number.isFinite) || maxHp <= 0) return false;
  if (newHp <= 0) return false;

  const oldPercent = (oldHp / maxHp) * 100;
  const newPercent = (newHp / maxHp) * 100;
  return oldPercent > threshold && newPercent <= threshold;
}

export function shouldShowUnconsciousCutin(damageItem, token, midiConfig = midiConfigSettings()) {
  if ((midiConfig?.addDead ?? "none") === "none") return false;

  const condition = zeroHpMidiCondition(token, midiConfig);
  if (!configuredMidiCondition(condition)) return false;

  const oldHp = Number(damageItem?.oldHP);
  const newHp = Number(damageItem?.newHP);
  if (![oldHp, newHp].every(Number.isFinite)) return false;

  return oldHp > 0 && newHp <= 0;
}

export function inferMidiAttackOutcome(workflow) {
  if (isCriticalWorkflow(workflow)) return getOutcomeState("critical");
  if (workflow?.hitTargets?.size > 0) return getOutcomeState("hit");

  const targets = workflow?.targets ?? globalThis.game?.user?.targets ?? [];
  const inferred = inferAttackOutcome(
    workflow?.attackRolls ?? workflow?.attackRoll ?? workflow?.rolls,
    targets
  );
  if (inferred) return inferred;

  if (workflow?.hitTargets instanceof Set && Array.from(targets).length && midiAutoCheckHitEnabled()) {
    return getOutcomeState("miss");
  }

  return null;
}

function isCriticalWorkflow(workflow) {
  if (workflow?.isCritical === true) return true;
  if (workflow?.workflowOptions?.isCritical === true) return true;
  if (workflow?.options?.isCritical === true) return true;
  if (workflow?.tracker?.isCritical === true) return true;
  if (workflow?.attackRollModifierTracker?.isCritical === true) return true;

  const rolls = Array.from(workflow?.attackRolls ?? []);
  if (workflow?.attackRoll) rolls.push(workflow.attackRoll);
  if (workflow?.rolls) rolls.push(...Array.from(workflow.rolls));
  return rolls.some((roll) => roll?.isCritical === true || roll?.options?.isCritical === true);
}

export function inferDamageType(workflow) {
  const detail = workflow?.damageDetail?.find?.((part) => part?.type);
  if (detail?.type) return detail.type;

  const activityParts = workflow?.activity?.damage?.parts ?? workflow?.item?.system?.damage?.parts ?? [];
  const firstPart = Array.from(activityParts)[0];
  return firstPart?.types?.first?.()
    ?? Array.from(firstPart?.types ?? [])[0]
    ?? firstPart?.type
    ?? "";
}

function matchingDamageToken(damageItem, tokens = []) {
  const tokenList = Array.from(tokens ?? []);
  return tokenList.find((token) => {
    const tokenUuid = token?.document?.uuid;
    const actorUuid = token?.actor?.uuid ?? token?.document?.actor?.uuid;
    return (damageItem?.targetUuid && damageItem.targetUuid === tokenUuid)
      || (damageItem?.tokenUuid && damageItem.tokenUuid === tokenUuid)
      || (damageItem?.actorUuid && damageItem.actorUuid === actorUuid);
  }) ?? null;
}

function formatDamageText(damageItem) {
  const damage = numericDamage(damageItem);
  if (!Number.isFinite(damage) || damage === 0) return "";
  const sign = damage > 0 ? "-" : "+";
  return `${sign}${Math.abs(Math.trunc(damage))}`;
}

function formatRemainingHp(damageItem) {
  const newHp = Number(damageItem?.newHP);
  if (!Number.isFinite(newHp)) return "";
  return `${Math.trunc(newHp)} HP`;
}

function numericDamage(damageItem) {
  const hpDamage = Number(damageItem?.hpDamage);
  const tempDamage = Number(damageItem?.tempDamage);
  const totalDamage = Number(damageItem?.totalDamage);

  if (Number.isFinite(hpDamage) || Number.isFinite(tempDamage)) {
    return (Number.isFinite(hpDamage) ? hpDamage : 0)
      + (Number.isFinite(tempDamage) ? tempDamage : 0);
  }

  return Number.isFinite(totalDamage) ? totalDamage : NaN;
}

function zeroHpMidiCondition(token, midiConfig) {
  const actor = token?.actor ?? token?.document?.actor;
  if (actor?.type === "character" || actor?.hasPlayerOwner || actor?.system?.traits?.important) {
    return midiConfig?.midiUnconsciousCondition;
  }

  return midiConfig?.midiDeadCondition ?? midiConfig?.midiUnconsciousCondition;
}

function configuredMidiCondition(condition) {
  return typeof condition === "string" && condition.trim().length > 0 && condition !== "none";
}

function midiConfigSettings() {
  try {
    return globalThis.game?.settings?.get?.("midi-qol", "ConfigSettings") ?? {};
  } catch (_error) {
    return {};
  }
}

function midiAutoCheckHitEnabled() {
  try {
    const config = globalThis.game?.settings?.get?.("midi-qol", "ConfigSettings");
    return config?.autoCheckHit !== "none";
  } catch (_error) {
    return true;
  }
}
