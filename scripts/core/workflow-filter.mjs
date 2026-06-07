import { hasValues } from "./collections.mjs";

export function shouldAnimateMidiWorkflow(workflow) {
  if (!workflow) return false;
  if (isAutomationOnlyWorkflow(workflow)) return false;
  if (isExternalTargetWorkflow(workflow)) return false;
  return true;
}

export function shouldAnimateDamageWorkflow(workflow) {
  if (!workflow) return false;
  return Boolean(
    hasValues(workflow?.targets)
      || hasValues(workflow?.hitTargets)
      || hasValues(workflow?.damageList)
      || hasValues(workflow?.damageDetail)
      || hasValues(workflow?.damageRolls)
      || workflow?.damageRoll
  );
}

export function isAutomationOnlyWorkflow(workflow) {
  const options = workflowOptions(workflow);
  const activity = workflow?.activity;
  const midiProperties = activity?.midiProperties ?? activity?.system?.midiProperties ?? {};
  const flags = activity?.flags?.["midi-qol"] ?? workflow?.flags?.["midi-qol"] ?? {};

  return Boolean(
    options.isOverTime
      || options.isReaction
      || options.isReactionWorkflow
      || options.automationOnly
      || activity?.isOverTimeFlag
      || midiProperties.automationOnly
      || midiProperties.isOverTime
      || flags.automationOnly
      || flags.isOverTime
  );
}

export function isExternalTargetWorkflow(workflow) {
  if (isOnlyBattleWorkflow(workflow)) return false;

  const options = workflowOptions(workflow);
  return Boolean(
    options.ignoreUserTargets
      || workflow?.ignoreUserTargets
      || hasValues(options.targetUuids)
      || hasValues(options.targetsToUse)
      || hasValues(workflow?.targetUuids)
      || hasValues(workflow?.targetsToUse)
  );
}

function isOnlyBattleWorkflow(workflow) {
  const options = workflowOptions(workflow);
  return Boolean(
    workflow?.onlybattle?.handledTargeting
      || options.onlybattle?.handledTargeting
      || workflow?.workflowOptions?.onlybattle?.handledTargeting
      || workflow?.options?.onlybattle?.handledTargeting
  );
}

function workflowOptions(workflow) {
  return workflow?.workflowOptions ?? workflow?.options?.workflowOptions ?? workflow?.options ?? {};
}
