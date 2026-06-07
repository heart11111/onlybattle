import { SETTINGS } from "./constants.mjs";
import { getSetting } from "./settings.mjs";
import { requestOnlyBattleTargets } from "./target-dialog.mjs";
import {
  createUsageWithMidiSuppression,
  getActivityTargetPolicy,
  hasExplicitExternalTargeting,
  isCombatEncounterAvailable,
  needsOnlyBattleTargeting,
  shouldSuppressMidiTargetConfirmation
} from "./core/targeting.mjs";
import {
  deletePlacedTemplates,
  placeActivityTemplates,
  selectUserTargets,
  tokensInsideTemplates
} from "./core/template-targeting.mjs";
import {
  isAutomationOnlyWorkflow,
  isExternalTargetWorkflow
} from "./core/workflow-filter.mjs";

export function registerMidiTargetingHook() {
  if (!game.modules.get("midi-qol")?.active) return;

  Hooks.on("midi-qol.preTargetingV2", async ({ workflow, usage }) => {
    if (usage?.onlybattle?.handledTargeting) return true;
    if (!usage) return true;
    const activity = workflow?.activity ?? workflow?.item?.system?.activities?.get?.(workflow?.activity?.id);
    if (shouldLetExistingWorkflowTarget(activity, usage, workflow)) return true;
    const nextUsage = await runOnlyBattleTargeting(activity, usage ?? {});
    if (nextUsage === false) return false;
    Object.assign(usage, nextUsage);
    return true;
  });
}

function shouldLetExistingWorkflowTarget(activity, usage, workflow) {
  if (isExternalTargetWorkflow(workflow)) return true;
  if (isAutomationOnlyWorkflow(workflow)) return true;
  if (isAutomationOnlyWorkflow({
    activity,
    workflowOptions: usage?.midiOptions?.workflowOptions ?? usage?.workflowOptions ?? usage?.midiOptions
  })) {
    return true;
  }
  return false;
}

async function runOnlyBattleTargeting(activity, usage = {}) {
  if (!activity || usage?.onlybattle?.handledTargeting) return usage;
  if (hasExplicitExternalTargeting(usage)) return usage;

  const inCombat = getSetting(SETTINGS.onlyInCombat) ? isCombatActive() : true;
  if (!needsOnlyBattleTargeting(activity, {
    inCombat,
    existingTargetCount: game.user?.targets?.size ?? 0
  })) {
    return usage;
  }

  const previousTargets = Array.from(game.user?.targets ?? []);
  const targetPolicy = getActivityTargetPolicy(activity);
  const placedTemplates = await placeTargetsFromTemplates(activity, targetPolicy);
  if (placedTemplates === false) return false;

  const targets = await requestOnlyBattleTargets(activity, {
    clearExisting: !placedTemplates.length,
    previousTargets,
    targetPolicy,
    templateMode: placedTemplates.length > 0
  });
  if (targets === false) {
    await deletePlacedTemplates(placedTemplates);
    return false;
  }

  const suppressMidiTargetConfirmation = shouldSuppressMidiTargetConfirmation({
    handledByOnlyBattle: true,
    showMidiTargetConfirmation: getSetting(SETTINGS.showMidiTargetConfirmation)
  });
  const templateUuids = placedTemplates.map((template) => template?.uuid ?? template?.document?.uuid).filter(Boolean);
  const targetUuids = targets.map((target) => target.document?.uuid).filter(Boolean);
  const nextUsage = createUsageWithMidiSuppression(usage, {
    suppressMidiTargetConfirmation,
    suppressMeasuredTemplateCreation: placedTemplates.length > 0,
    templateUuids,
    targetUuids
  });
  nextUsage.onlybattle = {
    ...(nextUsage.onlybattle ?? {}),
    handledTargeting: true,
    targetUuids
  };
  return nextUsage;
}

async function placeTargetsFromTemplates(activity, targetPolicy) {
  if (!targetPolicy.hasTemplate) return [];

  const templates = await placeActivityTemplates(activity);
  if (templates === false) return false;

  const targetTokens = tokensInsideTemplates(templates);
  selectUserTargets(targetTokens, { clearExisting: true });
  return templates;
}

function isCombatActive() {
  return isCombatEncounterAvailable(game.combat);
}
