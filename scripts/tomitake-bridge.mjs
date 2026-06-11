import { MODULE_ID, SETTINGS } from "./constants.mjs";

export const CREATED_GALLERY_MODULE_ID = "created-gallery";
export const ONLYBATTLE_TOMITAKE_HOOK = "onlybattle.tomitakeEvent";
export const CREATED_GALLERY_ONLYBATTLE_HOOK = "createdGallery.onlyBattleEvent";
export const TOMITAKE_EVENT_SCHEMA = "onlybattle.tomitake-event.v1";

export function isTomitakeBridgeEnabled() {
  return Boolean(
    globalThis.game?.settings?.get?.(MODULE_ID, SETTINGS.tomitakeBridgeEnabled)
      && globalThis.game?.modules?.get?.(CREATED_GALLERY_MODULE_ID)?.active
      && getCreatedGalleryModuleKey()
      && globalThis.Hooks?.callAll
  );
}

export function emitTomitakeBridgeEvent(payload) {
  if (!isTomitakeBridgeEnabled()) return false;

  const event = buildTomitakeBridgeEvent(payload);
  globalThis.Hooks.callAll(ONLYBATTLE_TOMITAKE_HOOK, event);
  globalThis.Hooks.callAll(CREATED_GALLERY_ONLYBATTLE_HOOK, event);
  return true;
}

export function buildTomitakeBridgeEvent({
  title = "",
  stage = "attack",
  outcome = "",
  outcomeBadge = "",
  damageType = "",
  source = null,
  targets = [],
  damageSummaries = [],
  scene = currentSceneSnapshot(),
  combat = currentCombatSnapshot(),
  createdAt = Date.now()
} = {}) {
  return {
    schemaVersion: TOMITAKE_EVENT_SCHEMA,
    moduleId: MODULE_ID,
    eventType: "combat-overlay",
    title,
    stage,
    outcome,
    outcomeBadge,
    damageType,
    createdAt,
    scene: compactScene(scene),
    combat: compactCombat(combat),
    source: compactToken(source),
    targets: Array.from(targets ?? []).map(compactToken).filter(Boolean),
    damageSummaries: compactDamageSummaries(damageSummaries)
  };
}

function currentSceneSnapshot() {
  return globalThis.canvas?.scene ?? null;
}

function getCreatedGalleryModuleKey() {
  try {
    const value = globalThis.game?.settings?.get?.(CREATED_GALLERY_MODULE_ID, "moduleKey");
    return typeof value === "string" ? value.trim() : "";
  } catch (_) {
    return "";
  }
}

function currentCombatSnapshot() {
  return globalThis.game?.combat ?? null;
}

function compactScene(scene) {
  if (!scene) return null;
  return {
    id: scene.id ?? null,
    uuid: scene.uuid ?? null,
    name: scene.name ?? ""
  };
}

function compactCombat(combat) {
  if (!combat) return null;
  return {
    id: combat.id ?? null,
    round: combat.round ?? null,
    turn: combat.turn ?? null
  };
}

function compactToken(token) {
  const normalized = token?.object ?? token;
  if (!normalized) return null;

  const document = normalized.document ?? normalized;
  const actor = normalized.actor ?? document.actor ?? null;
  const center = normalized.center ?? document.center ?? null;

  return {
    id: normalized.id ?? document.id ?? null,
    uuid: document.uuid ?? normalized.uuid ?? null,
    name: normalized.name ?? document.name ?? actor?.name ?? "",
    actorId: actor?.id ?? normalized.actorId ?? document.actorId ?? null,
    actorUuid: actor?.uuid ?? normalized.actorUuid ?? document.actorUuid ?? null,
    disposition: document.disposition ?? normalized.disposition ?? null,
    x: document.x ?? normalized.x ?? null,
    y: document.y ?? normalized.y ?? null,
    center: center ? {
      x: center.x ?? null,
      y: center.y ?? null
    } : null,
    width: document.width ?? normalized.width ?? null,
    height: document.height ?? normalized.height ?? null,
    elevation: document.elevation ?? normalized.elevation ?? null
  };
}

function compactDamageSummaries(damageSummaries) {
  return Array.from(damageSummaries ?? []).map((summary) => {
    const compact = {
      tokenUuid: summary?.tokenUuid ?? null,
      damageText: summary?.damageText ?? "",
      hpText: summary?.hpText ?? ""
    };
    if (summary?.actorUuid) compact.actorUuid = summary.actorUuid;
    if (summary?.bloodied) compact.bloodied = true;
    if (summary?.unconscious) compact.unconscious = true;
    return compact;
  });
}
