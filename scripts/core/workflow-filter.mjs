import { hasValues } from "./collections.mjs";
import {
  hasExplicitFalseOption,
  hasTruthyOption,
  hasValuedOption,
  midiOptionSources
} from "./midi-options.mjs";

const AUTOMATION_ONLY_FLAGS = ["isOverTime", "isReaction", "isReactionWorkflow", "automationOnly"];
const EXTERNAL_TARGET_FLAGS = ["ignoreUserTargets"];
const EXTERNAL_TARGET_VALUES = ["targetUuids", "targetsToUse"];
const AUTOMATION_OWNER_FLAGS = ["workflowData", "checkGMStatus", "noOnUseMacro"];
const AUTOMATED_ROLL_FLAGS = [
  "autoRollAttack",
  "autoRollDamage",
  "autoFastAttack",
  "autoFastDamage",
  "fastForwardAttack",
  "fastForwardDamage"
];
const SUPPRESSED_UI_FLAGS = ["configureDialog", "showFullCard"];

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
  const activity = workflow?.activity;
  const midiProperties = activity?.midiProperties ?? activity?.system?.midiProperties ?? {};
  const flags = activity?.flags?.["midi-qol"] ?? workflow?.flags?.["midi-qol"] ?? {};

  return Boolean(
    hasTruthyOption(workflow, AUTOMATION_ONLY_FLAGS)
      || activity?.isOverTimeFlag
      || midiProperties.automationOnly
      || midiProperties.isOverTime
      || flags.automationOnly
      || flags.isOverTime
  );
}

export function isExternalTargetWorkflow(workflow) {
  if (isOnlyBattleWorkflow(workflow)) return false;

  return Boolean(
    hasTruthyOption(workflow, EXTERNAL_TARGET_FLAGS)
      || hasValuedOption(workflow, EXTERNAL_TARGET_VALUES)
      || isExternallyOwnedAutomation(workflow)
  );
}

function isOnlyBattleWorkflow(workflow) {
  return Boolean(
    workflow?.onlybattle?.handledTargeting
      || midiOptionSources(workflow).some((options) => options?.onlybattle?.handledTargeting)
  );
}

function isExternallyOwnedAutomation(workflow) {
  return Boolean(
    hasTruthyOption(workflow, AUTOMATION_OWNER_FLAGS)
      || (hasExplicitFalseOption(workflow, SUPPRESSED_UI_FLAGS) && hasTruthyOption(workflow, AUTOMATED_ROLL_FLAGS))
  );
}
