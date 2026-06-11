import { hasValues } from "./collections.mjs";

export function hasTruthyOption(source, keys) {
  return midiOptionSources(source).some((options) => keys.some((key) => Boolean(options?.[key])));
}

export function hasExplicitFalseOption(source, keys) {
  return midiOptionSources(source).some((options) => keys.some((key) => options?.[key] === false));
}

export function hasValuedOption(source, keys) {
  return midiOptionSources(source).some((options) => keys.some((key) => hasValues(options?.[key])));
}

export function midiOptionSources(source) {
  return [
    source?.workflowOptions,
    source?.options?.workflowOptions,
    source?.options?.midiOptions?.workflowOptions,
    source?.config?.workflowOptions,
    source?.config?.midiOptions?.workflowOptions,
    source?.midiOptions?.workflowOptions,
    source?.options?.midiOptions,
    source?.config?.midiOptions,
    source?.midiOptions,
    source?.options,
    source
  ].filter((options) => options && typeof options === "object");
}
