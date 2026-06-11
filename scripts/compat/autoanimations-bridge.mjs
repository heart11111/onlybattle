import { MODULE_ID, SETTINGS } from "../constants.mjs";
import { debug } from "../logger.mjs";

const CANVAS_ONLY_MENUS = new Set(["aura", "aefx"]);
const PERSISTENT_TEMPLATE_TYPES = new Set(["attachtemplate", "groundtile", "overheadtile"]);

export function registerAutoAnimationsBridge({ showIsoAnimation = null } = {}) {
  if (!globalThis.Hooks?.on) return;

  Hooks.on("AutomatedAnimations-WorkflowStart", (clonedData, animationData) => {
    if (!autoAnimationsBridgeEnabled()) return;
    if (!shouldRouteAutoAnimationsWorkflowToIso(animationData)) return;

    const request = buildIsoAnimationRequest({ clonedData, animationData });
    if (!request.effects.length) return;

    clonedData.stopWorkflow = true;
    const show = showIsoAnimation ?? ((payload) => globalThis.OnlyBattle?.overlay?.showIsoAnimation?.(payload));
    show(request);
  });
}

export function shouldRouteAutoAnimationsWorkflowToIso(animationData) {
  return classifyAutoAnimationsWorkflow(animationData) !== "canvas";
}

export function classifyAutoAnimationsWorkflow(animationData = {}) {
  const menu = animationData?.menu;
  if (!menu || CANVAS_ONLY_MENUS.has(menu)) return "canvas";

  if (menu === "melee") return "melee";
  if (menu === "range") return "projectile";

  if (menu === "ontoken") {
    return sectionIsPersistent(animationData.primary) ? "canvas" : "burst";
  }

  if (menu === "templatefx") {
    return sectionIsPersistent(animationData.primary) ? "canvas" : "area";
  }

  if (menu === "preset" && animationData.presetType === "proToTemp") {
    return hasPersistentAfterImage(animationData) ? "canvas" : "projectile-template";
  }

  return "canvas";
}

export function buildIsoAnimationRequest({ clonedData = {}, animationData = {} } = {}) {
  const source = normalizeToken(clonedData.token);
  const targets = Array.from(clonedData.hitTargets?.length ? clonedData.hitTargets : clonedData.targets ?? [])
    .map(normalizeToken)
    .filter(Boolean);
  const type = classifyAutoAnimationsWorkflow(animationData);
  const title = clonedData.item?.name ?? clonedData.activity?.item?.name ?? clonedData.activity?.name ?? "";
  const effects = buildEffects(type, animationData, source, targets);

  return {
    title,
    source,
    targets,
    effects
  };
}

function buildEffects(type, animationData, source, targets) {
  if (!source) return [];

  if (type === "projectile-template") {
    return buildProjectileTemplateEffects(animationData, source, targets);
  }

  if (type === "burst") {
    return effectTargets(targets.length ? targets : [source], animationData.primary, {
      kind: "burst",
      source
    });
  }

  if (type === "area") {
    return effectTargets(targets.length ? targets : [source], animationData.primary, {
      kind: "area",
      source
    });
  }

  const section = animationData.primary;
  return targets.flatMap((target) => {
    const file = effectFile(section);
    if (!file) return [];
    return [{
      kind: type === "melee" ? "melee" : "projectile",
      file,
      sourceId: tokenId(source),
      targetId: tokenId(target),
      repeat: optionNumber(section, "repeat", 1),
      repeatDelay: optionNumber(section, "repeatDelay", 250),
      playbackRate: optionNumber(section, "playbackRate", 1),
      label: section?.video?.animation ?? "",
      color: section?.video?.color ?? ""
    }];
  });
}

function buildProjectileTemplateEffects(animationData, source, targets) {
  const data = animationData.data ?? {};
  const destination = targets[0] ?? source;
  const effects = [];
  const projectile = sectionEffect(data.projectile, {
    kind: "projectile",
    sourceId: tokenId(source),
    targetId: tokenId(destination)
  });
  const preExplosion = data.preExplosion?.enable ? sectionEffect(data.preExplosion, {
    kind: "burst",
    sourceId: tokenId(source),
    targetId: tokenId(destination)
  }) : null;
  const explosion = sectionEffect(data.explosion, {
    kind: "burst",
    sourceId: tokenId(source),
    targetId: tokenId(destination)
  });

  if (projectile) effects.push(projectile);
  if (preExplosion) effects.push(preExplosion);
  if (explosion) effects.push(explosion);
  return effects;
}

function effectTargets(tokens, section, { kind, source }) {
  const file = effectFile(section);
  if (!file) return [];
  return tokens.map((target) => ({
    kind,
    file,
    sourceId: tokenId(source),
    targetId: tokenId(target),
    repeat: optionNumber(section, "repeat", 1),
    repeatDelay: optionNumber(section, "repeatDelay", 250),
    playbackRate: optionNumber(section, "playbackRate", 1),
    label: section?.video?.animation ?? "",
    color: section?.video?.color ?? ""
  }));
}

function sectionEffect(section, base) {
  const file = effectFile(section);
  if (!file) return null;
  return {
    ...base,
    file,
    repeat: optionNumber(section, "repeat", 1),
    repeatDelay: optionNumber(section, "repeatDelay", 250),
    playbackRate: optionNumber(section, "playbackRate", 1),
    label: section?.video?.animation ?? section?.animation ?? "",
    color: section?.video?.color ?? section?.color ?? ""
  };
}

function sectionIsPersistent(section = {}) {
  const options = section?.options ?? {};
  return Boolean(options.persistent)
    || PERSISTENT_TEMPLATE_TYPES.has(String(options.persistType ?? "").toLowerCase());
}

function hasPersistentAfterImage(animationData) {
  const afterImage = animationData?.data?.afterImage;
  return Boolean(afterImage?.enable && afterImage?.options?.persistent);
}

function effectFile(section = {}) {
  return firstPath(
    section?.path?.file,
    section?.path?.filePath,
    section?.customPath,
    section?.video?.customPath,
    section?.file,
    autoAnimationsDatabaseFile(section?.video ?? section)
  );
}

function autoAnimationsDatabaseFile(video = {}) {
  const databasePath = autoAnimationsDatabasePath(video);
  if (!databasePath) return "";

  try {
    const entry = globalThis.Sequencer?.Database?.getEntry?.(databasePath, { softFail: true });
    return sequencerEntryFile(entry);
  } catch (error) {
    debug("Unable to resolve AutoAnimations database entry.", { databasePath, error });
    return "";
  }
}

function autoAnimationsDatabasePath(video = {}) {
  const dbSection = video.dbSection;
  const menuType = video.menuType;
  const animation = video.animation;
  const variant = video.variant;
  const color = video.color;
  if (!dbSection || !menuType || !animation || !variant) return "";

  const basePath = `autoanimations.${dbSection}.${menuType}.${animation}.${variant}`;
  return color && color !== "random" ? `${basePath}.${color}` : basePath;
}

function sequencerEntryFile(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (Array.isArray(entry)) return firstPath(...entry.map(sequencerEntryFile));

  return firstPath(
    entry.file,
    entry.src,
    entry.path,
    entry.filePath,
    entry.video,
    entry.animation
  );
}

function firstPath(...paths) {
  return paths.find((path) => typeof path === "string" && path.trim().length > 0) ?? "";
}

function optionNumber(section, key, fallback) {
  const value = Number(section?.options?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeToken(token) {
  return token?.object ?? token;
}

function tokenId(token) {
  return token?.id ?? token?.document?.uuid ?? token?.name ?? "";
}

function autoAnimationsBridgeEnabled() {
  try {
    return globalThis.game?.settings?.get?.(MODULE_ID, SETTINGS.enableAutoAnimationsBridge) !== false;
  } catch (error) {
    debug("Falling back to enabled AutoAnimations bridge setting.", error);
    return true;
  }
}
