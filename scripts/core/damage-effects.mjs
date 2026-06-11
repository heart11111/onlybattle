const PHYSICAL_DAMAGE_TYPES = new Set(["bludgeoning", "piercing", "slashing"]);
const TEMPORARY_EFFECT_KEYS = new Set([
  "acid",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "poison",
  "psychic",
  "radiant",
  "thunder"
]);

export function normalizeDamageType(damageType) {
  return String(damageType ?? "")
    .trim()
    .toLowerCase()
    .split(",")[0]
    .trim();
}

export function getDamageEffect(damageType) {
  const normalized = normalizeDamageType(damageType);
  if (!normalized) return null;

  return {
    key: effectKeyForDamageType(normalized),
    damageType: normalized
  };
}

function effectKeyForDamageType(damageType) {
  if (PHYSICAL_DAMAGE_TYPES.has(damageType)) return "impact";
  if (TEMPORARY_EFFECT_KEYS.has(damageType)) return damageType;
  return "impact";
}
