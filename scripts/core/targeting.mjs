import { hasValues } from "./collections.mjs";

const SELF_TARGET_TYPES = new Set(["", "self", undefined, null]);

export function isCombatEncounterAvailable(combat) {
  return Boolean(combat);
}

export function needsOnlyBattleTargeting(activity, context = {}) {
  if (!activity) return false;
  if (context.inCombat === false) return false;

  const targetType = activity.target?.affects?.type ?? activity.target?.type;
  if (hasTemplateTarget(activity)) return false;
  if (SELF_TARGET_TYPES.has(targetType) && !activity.attack && !activity.target?.template?.type) return false;
  if (targetType === "self" && !activity.target?.template?.type) return false;

  return Boolean(
    activity.attack
      || activity.type === "attack"
      || activity.type === "save"
      || !SELF_TARGET_TYPES.has(targetType)
  );
}

export function getActivityTargetPolicy(activity) {
  const hasTemplate = hasTemplateTarget(activity);
  const maxTargets = toPositiveInteger(activity?.target?.affects?.count);
  const templateCount = hasTemplate ? (toPositiveInteger(activity?.target?.template?.count) ?? 1) : 0;
  const targetLabel = activity?.target?.affects?.labels?.sheet
    ?? activity?.target?.affects?.label
    ?? activity?.target?.template?.label
    ?? "";

  return {
    hasTemplate,
    allowsMultiple: Boolean(hasTemplate || !maxTargets || maxTargets > 1),
    maxTargets,
    minTargets: 1,
    targetLabel,
    templateCount
  };
}

export function hasTemplateTarget(activity) {
  const templateType = activity?.target?.template?.type;
  return Boolean(templateType && templateType !== "emanationNoTemplate");
}

export function validateTargetCount(targets, policy = {}) {
  const count = Array.from(targets ?? []).length;
  const minTargets = policy.minTargets ?? 1;

  if (count < minTargets) return "ONLYBATTLE.TargetDialog.NoTargets";
  if (policy.maxTargets && count > policy.maxTargets) return "ONLYBATTLE.TargetDialog.TooManyTargets";
  return null;
}

export function hasExplicitExternalTargeting(usage = {}) {
  const midiOptions = usage?.midiOptions ?? {};
  return Boolean(
    usage.ignoreUserTargets
      || midiOptions.ignoreUserTargets
      || hasValues(usage.targetUuids)
      || hasValues(usage.targetsToUse)
      || hasValues(midiOptions.targetUuids)
      || hasValues(midiOptions.targetsToUse)
  );
}

export function shouldSuppressMidiTargetConfirmation({
  handledByOnlyBattle,
  showMidiTargetConfirmation
} = {}) {
  return Boolean(handledByOnlyBattle && !showMidiTargetConfirmation);
}

export function createUsageWithMidiSuppression(usage = {}, {
  suppressMidiTargetConfirmation = false,
  suppressMeasuredTemplateCreation = false,
  templateUuids = [],
  targetUuids = []
} = {}) {
  const next = {
    ...usage,
    create: {
      ...(usage.create ?? {})
    },
    midiOptions: {
      ...(usage.midiOptions ?? {}),
      workflowOptions: {
        ...(usage.midiOptions?.workflowOptions ?? {})
      }
    }
  };

  if (suppressMidiTargetConfirmation) {
    next.midiOptions.workflowOptions.targetConfirmation = "never";
  }

  if (suppressMeasuredTemplateCreation) {
    next.create.measuredTemplate = false;
  }

  if (targetUuids.length) {
    const uuids = Array.from(targetUuids);
    next.midiOptions.targetUuids = uuids;
    next.midiOptions.workflowOptions.onlybattle = {
      ...(next.midiOptions.workflowOptions.onlybattle ?? {}),
      handledTargeting: true,
      targetUuids: uuids
    };
  }

  if (templateUuids.length) {
    next.onlybattle = {
      ...(next.onlybattle ?? {}),
      templateUuids: Array.from(templateUuids)
    };
  }

  return next;
}

function toPositiveInteger(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}
