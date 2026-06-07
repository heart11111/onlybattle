export async function placeActivityTemplates(activity) {
  const TemplateClass = globalThis.game?.system?.canvas?.AbilityTemplate
    ?? globalThis.CONFIG?.DND5E?.canvas?.AbilityTemplate;
  const previews = TemplateClass?.fromActivity?.(activity);
  if (!previews) return [];

  const documents = [];
  for (const preview of previews) {
    const result = await preview.drawPreview();
    if (!result) return false;
    documents.push(...normalizeArray(result));
  }
  return documents;
}

export function tokensInsideTemplates(
  templates,
  tokens = globalThis.canvas?.tokens?.placeables ?? [],
  options = {}
) {
  const selected = [];
  const seen = new Set();

  for (const template of normalizeArray(templates)) {
    for (const token of normalizeArray(tokens)) {
      if (!token || seen.has(getTokenKey(token))) continue;
      if (!isTokenInsideTemplate(template, token, options)) continue;
      selected.push(token);
      seen.add(getTokenKey(token));
    }
  }

  return selected;
}

export function selectUserTargets(tokens, { clearExisting = true } = {}) {
  if (clearExisting) clearUserTargets();

  for (const token of normalizeArray(tokens)) {
    token?.setTarget?.(true, { releaseOthers: false });
  }
}

export async function deletePlacedTemplates(templates) {
  for (const template of normalizeArray(templates)) {
    const document = template?.document ?? template;
    await document?.delete?.();
  }
}

export function clearUserTargets() {
  for (const target of Array.from(globalThis.game?.user?.targets ?? [])) {
    target?.setTarget?.(false, { releaseOthers: false });
  }
}

export function isTokenInsideTemplate(template, token, options = {}) {
  const templateObject = resolveTemplateObject(template);
  const document = templateObject?.document ?? template;
  const shape = templateObject?.shape ?? template?.shape;
  if (!shape || typeof shape.contains !== "function") return false;

  const origin = {
    x: Number(document?.x ?? templateObject?.x ?? 0),
    y: Number(document?.y ?? templateObject?.y ?? 0)
  };

  for (const point of getTokenSamplePoints(token, options)) {
    if (shape.contains(point.x - origin.x, point.y - origin.y)) return true;
  }

  return false;
}

function getTokenSamplePoints(token, options = {}) {
  if (token?.center) return [token.center];

  const gridSize = options.grid?.size ?? globalThis.canvas?.grid?.size ?? globalThis.canvas?.scene?.grid?.size ?? 1;
  const document = token?.document ?? token;
  const x = Number(token?.x ?? document?.x ?? 0);
  const y = Number(token?.y ?? document?.y ?? 0);
  const width = Number(document?.width ?? 1);
  const height = Number(document?.height ?? 1);
  const points = [];
  const startX = width >= 1 ? 0.5 : width / 2;
  const startY = height >= 1 ? 0.5 : height / 2;

  for (let offsetX = startX; offsetX < width; offsetX += 1) {
    for (let offsetY = startY; offsetY < height; offsetY += 1) {
      points.push({
        x: x + (offsetX * gridSize),
        y: y + (offsetY * gridSize)
      });
    }
  }

  return points.length ? points : [{ x: x + (width * gridSize / 2), y: y + (height * gridSize / 2) }];
}

function resolveTemplateObject(template) {
  if (typeof template === "string") {
    return globalThis.fromUuidSync?.(template)?.object ?? null;
  }
  return template?.object ?? template;
}

function getTokenKey(token) {
  return token?.document?.uuid ?? token?.uuid ?? token?.id ?? token;
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
