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

export function inferMidiAttackOutcome(workflow) {
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

function midiAutoCheckHitEnabled() {
  try {
    const config = globalThis.game?.settings?.get?.("midi-qol", "ConfigSettings");
    return config?.autoCheckHit !== "none";
  } catch (_error) {
    return true;
  }
}
