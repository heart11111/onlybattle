const OUTCOME_KEYS = {
  critical: {
    outcome: "ONLYBATTLE.Overlay.Critical",
    outcomeBadge: "ONLYBATTLE.Overlay.CriticalBang"
  },
  hit: {
    outcome: "ONLYBATTLE.Overlay.Hit",
    outcomeBadge: "ONLYBATTLE.Overlay.HitBang"
  },
  miss: {
    outcome: "ONLYBATTLE.Overlay.Miss",
    outcomeBadge: "ONLYBATTLE.Overlay.MissBang"
  },
  damage: {
    outcome: "ONLYBATTLE.Overlay.Damage",
    outcomeBadge: "ONLYBATTLE.Overlay.DamageBang"
  }
};

export function getOutcomeBadgeKey(stage) {
  return OUTCOME_KEYS[stage]?.outcomeBadge ?? "";
}

export function getOutcomeState(stage) {
  const keys = OUTCOME_KEYS[stage];
  return keys ? { stage, ...keys } : null;
}

export function inferAttackOutcome(rolls, targets = []) {
  const roll = firstRoll(rolls);
  if (!roll) return null;

  if (roll.isCritical === true) return getOutcomeState("critical");
  if (roll.isFumble === true) return getOutcomeState("miss");
  if (roll.isSuccess === true) return getOutcomeState("hit");
  if (roll.isFailure === true) return getOutcomeState("miss");

  const total = toFiniteNumber(roll.total);
  const target = onlyTarget(targets);
  const ac = target ? tokenArmorClass(target) : toFiniteNumber(roll.options?.target);
  if (total === null || ac === null) return null;

  return getOutcomeState(total >= ac ? "hit" : "miss");
}

export function tokenArmorClass(token) {
  const normalized = token?.object ?? token;
  const ac = normalized?.actor?.system?.attributes?.ac
    ?? normalized?.document?.actor?.system?.attributes?.ac;

  return firstFiniteNumber(
    ac?.value,
    ac?.flat,
    ac?.base,
    typeof ac === "number" || typeof ac === "string" ? ac : null
  );
}

function firstRoll(rolls) {
  if (Array.isArray(rolls)) return rolls[0] ?? null;
  return rolls ?? null;
}

function onlyTarget(targets) {
  const entries = Array.from(targets ?? []);
  return entries.length === 1 ? entries[0] : null;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = toFiniteNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
