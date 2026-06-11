import { MODULE_ID } from "../constants.mjs";

export const IMAGE_SETTING_KEYS = [
  "iso",
  "portrait",
  "cutin",
  "criticalCutin",
  "bloodiedCutin",
  "unconsciousCutin"
];

export function normalizeOnlyBattleImages(value) {
  if (!value || typeof value !== "object") return {};

  const images = {};
  for (const key of IMAGE_SETTING_KEYS) {
    const path = cleanPath(value[key]);
    if (path) images[key] = path;
  }
  return images;
}

export function getOnlyBattleImageForToken(token, registry = {}, key = "iso") {
  return firstPath(
    documentImageSetting(token?.document, key),
    registryImageSetting(registry, token?.document?.uuid, key),
    documentImageSetting(token?.actor ?? token?.document?.actor, key),
    registryImageSetting(registry, token?.actor?.uuid ?? token?.document?.actor?.uuid, key)
  );
}

export function hasOnlyBattleImageSetting(token, registry = {}, key = "iso") {
  return Boolean(getOnlyBattleImageForToken(token, registry, key));
}

function documentImageSetting(document, key) {
  if (!document) return "";
  return normalizeOnlyBattleImages(
    document.getFlag?.(MODULE_ID, "images")
      ?? document.flags?.[MODULE_ID]?.images
  )[key] ?? "";
}

function registryImageSetting(registry, uuid, key) {
  if (!uuid) return "";
  const entry = registry?.[uuid];
  if (typeof entry === "string") return key === "iso" ? cleanPath(entry) : "";
  return normalizeOnlyBattleImages(entry)[key] ?? "";
}

function firstPath(...paths) {
  return paths.find((path) => typeof path === "string" && path.trim().length > 0) ?? "";
}

function cleanPath(path) {
  return typeof path === "string" ? path.trim() : "";
}
