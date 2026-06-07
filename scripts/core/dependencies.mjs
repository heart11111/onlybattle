export const REQUIRED_MODULE_IDS = ["midi-qol"];

export function getInactiveRequiredModules(modules, requiredModuleIds = REQUIRED_MODULE_IDS) {
  return requiredModuleIds.filter((moduleId) => !modules?.get?.(moduleId)?.active);
}
