const DEFAULT_SCENE_SIZE = { width: 560, height: 340 };
const DEFAULT_GRID = { size: 100, distance: 5, units: "ft" };
const MIN_TOKEN_SCALE = 0.45;
const SCENE_PADDING = 18;
const ISO_TOKEN_FOOTPRINT = {
  width: 96,
  aboveAnchor: 76,
  belowAnchor: 20
};
const FALLBACK_TOKEN_FOOTPRINT = {
  width: 52,
  aboveAnchor: 26,
  belowAnchor: 26
};

export function getIsoImageForToken(token, registry = {}) {
  const tokenUuid = token?.document?.uuid;
  const actorUuid = token?.actor?.uuid ?? token?.document?.actor?.uuid;

  return firstImagePath(
    registry[tokenUuid],
    registry[actorUuid],
    token?.document?.texture?.src,
    token?.texture?.src,
    token?.document?.img,
    token?.actor?.prototypeToken?.texture?.src,
    token?.actor?.img,
    token?.document?.actor?.img
  );
}

export function getPortraitForToken(token) {
  return firstImagePath(
    token?.actor?.img,
    token?.document?.actor?.img,
    token?.document?.texture?.src,
    token?.texture?.src,
    token?.document?.img,
    token?.actor?.prototypeToken?.texture?.src
  );
}

export function projectCanvasToIso(point, origin, scale = 0.5) {
  const dx = (point?.x ?? 0) - (origin?.x ?? 0);
  const dy = (point?.y ?? 0) - (origin?.y ?? 0);

  return {
    x: (dx - dy) * scale,
    y: (dx + dy) * scale * 0.5
  };
}

export function getTokenGridCenter(token, grid = {}) {
  const gridSize = grid.gridSize ?? grid.size ?? globalThis.canvas?.grid?.size
    ?? globalThis.canvas?.scene?.grid?.size
    ?? DEFAULT_GRID.size;
  const tokenX = token?.document?.x ?? token?.x;
  const tokenY = token?.document?.y ?? token?.y;
  const width = tokenGridWidth(token);
  const height = tokenGridHeight(token);

  if (Number.isFinite(tokenX) && Number.isFinite(tokenY) && gridSize > 0) {
    return {
      x: tokenX + ((width * gridSize) / 2),
      y: tokenY + ((height * gridSize) / 2)
    };
  }

  return token?.center ?? { x: 0, y: 0 };
}

export function measureTokenDistance(source, target, grid = {}) {
  const sourceCenter = getTokenGridCenter(source, grid);
  const targetCenter = getTokenGridCenter(target, grid);
  const gridSize = grid.gridSize ?? grid.size ?? globalThis.canvas?.grid?.size
    ?? globalThis.canvas?.scene?.grid?.size
    ?? DEFAULT_GRID.size;
  const gridDistance = grid.gridDistance ?? grid.distance ?? globalThis.canvas?.scene?.grid?.distance
    ?? DEFAULT_GRID.distance;
  const units = grid.units ?? globalThis.canvas?.scene?.grid?.units ?? DEFAULT_GRID.units;

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const value = gridSize > 0 ? (Math.hypot(dx, dy) / gridSize) * gridDistance : 0;

  return {
    value: Math.round(value * 10) / 10,
    units
  };
}

export function buildCombatScene({
  source,
  targets = [],
  registry = {},
  size = DEFAULT_SCENE_SIZE,
  grid = {}
} = {}) {
  const participants = [
    { role: "source", token: source },
    ...targets.filter(Boolean).map((target) => ({ role: "target", token: target }))
  ].filter((entry) => entry.token);

  const origin = source ? getTokenGridCenter(source, grid) : getTokenGridCenter(participants[0]?.token, grid);
  const rawProjected = participants.map(({ role, token }) => {
    const tokenCenter = getTokenGridCenter(token, grid);
    const tokenSize = getTokenGridSize(token);
    const iso = projectCanvasToIso(tokenCenter, origin);
    const artMode = hasRegisteredIsoImage(token, registry) ? "iso" : "token";
    return {
      id: token.document?.uuid ?? token.id ?? token.name,
      name: token.name ?? token.actor?.name ?? "Token",
      role,
      img: getIsoImageForToken(token, registry),
      artMode,
      portrait: getPortraitForToken(token),
      iso,
      gridCenter: tokenCenter,
      size: tokenSize,
      sizeScale: tokenSize.cells,
      disposition: token.document?.disposition ?? 0,
      distance: role === "source" ? { value: 0, units: grid.units ?? DEFAULT_GRID.units } : measureTokenDistance(source, token, grid)
    };
  });

  const fit = fitProjectedTokens(rawProjected, size);
  const projected = fit.entries;
  const bounds = calculateVisualBounds(projected);
  const offset = {
    x: (size.width - bounds.width) / 2 - bounds.minX,
    y: (size.height - bounds.height) / 2 - bounds.minY
  };
  const sceneTokens = projected.map((entry) => ({
    ...entry,
    x: Math.round(entry.iso.x + offset.x),
    y: Math.round(entry.iso.y + offset.y),
    visualBounds: offsetVisualBounds(entry.visualBounds, offset)
  }));
  const sourceAnchor = sceneTokens.find((token) => token.role === "source") ?? sceneTokens[0];

  return {
    size,
    zoom: fit.sceneScale,
    grid: buildIsoGrid(size, {
      origin: sourceAnchor ? { x: sourceAnchor.x, y: sourceAnchor.y } : undefined,
      zoom: fit.sceneScale
    }),
    bounds,
    portraits: buildPortraits(sceneTokens),
    tokens: sceneTokens
  };
}

function buildPortraits(tokens) {
  const source = tokens.find((token) => token.role === "source");
  const targets = tokens.filter((token) => token.role === "target");

  return {
    source: source ? portraitFromToken(source) : null,
    target: targets[0] ? portraitFromToken(targets[0]) : null,
    targets: targets.map(portraitFromToken)
  };
}

function portraitFromToken(token) {
  return {
    id: token.id,
    name: token.name,
    img: token.portrait,
    distance: token.distance
  };
}

function fitProjectedTokens(entries, size) {
  if (!entries.length) return { entries, sceneScale: 1 };

  const bounds = calculateBounds(entries);
  const sceneScale = calculateSceneScale(entries, bounds, size);
  const tokenScale = calculateTokenScale(sceneScale);

  const scaledEntries = entries.map((entry) => {
    const next = {
      ...entry,
      scale: tokenScale,
      iso: {
        x: entry.iso.x * sceneScale,
        y: entry.iso.y * sceneScale
      }
    };
    return {
      ...next,
      visualBounds: calculateTokenVisualBounds(next)
    };
  });

  return {
    entries: scaledEntries,
    sceneScale
  };
}

function calculateSceneScale(entries, bounds, size) {
  let sceneScale = 1;

  for (let i = 0; i < 4; i++) {
    const tokenScale = calculateTokenScale(sceneScale);
    const footprint = largestFootprint(entries);
    const availableWidth = Math.max(80, size.width - (SCENE_PADDING * 2) - (footprint.width * tokenScale));
    const availableHeight = Math.max(
      80,
      size.height - (SCENE_PADDING * 2) - ((footprint.aboveAnchor + footprint.belowAnchor) * tokenScale)
    );

    sceneScale = Math.min(
      1,
      bounds.width > 0 ? availableWidth / bounds.width : 1,
      bounds.height > 0 ? availableHeight / bounds.height : 1
    );
  }

  return roundScale(sceneScale);
}

function calculateTokenScale(sceneScale) {
  return roundScale(Math.max(MIN_TOKEN_SCALE, Math.min(1, sceneScale)));
}

function calculateTokenVisualBounds(entry) {
  const scale = entry.scale ?? 1;
  const footprint = tokenFootprint(entry);
  const sizeScale = entry.sizeScale ?? 1;
  const totalScale = scale * sizeScale;
  const halfWidth = (footprint.width * totalScale) / 2;
  return {
    left: entry.iso.x - halfWidth,
    right: entry.iso.x + halfWidth,
    top: entry.iso.y - (footprint.aboveAnchor * totalScale),
    bottom: entry.iso.y + (footprint.belowAnchor * totalScale)
  };
}

function calculateVisualBounds(entries) {
  if (!entries.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

  const left = Math.min(...entries.map((entry) => entry.visualBounds.left));
  const right = Math.max(...entries.map((entry) => entry.visualBounds.right));
  const top = Math.min(...entries.map((entry) => entry.visualBounds.top));
  const bottom = Math.max(...entries.map((entry) => entry.visualBounds.bottom));

  return {
    minX: left,
    minY: top,
    maxX: right,
    maxY: bottom,
    width: right - left,
    height: bottom - top
  };
}

function offsetVisualBounds(bounds, offset) {
  return {
    left: Math.round(bounds.left + offset.x),
    right: Math.round(bounds.right + offset.x),
    top: Math.round(bounds.top + offset.y),
    bottom: Math.round(bounds.bottom + offset.y)
  };
}

function roundScale(scale) {
  return Math.round(scale * 1000) / 1000;
}

function buildIsoGrid(size, { origin, zoom = 1 } = {}) {
  const center = { x: size.width / 2, y: size.height / 2 + 8 };
  const radius = { x: size.width * 0.43, y: size.height * 0.36 };
  const points = [
    { x: center.x, y: center.y - radius.y },
    { x: center.x + radius.x, y: center.y },
    { x: center.x, y: center.y + radius.y },
    { x: center.x - radius.x, y: center.y }
  ];
  const lines = [];
  const stepX = Math.max(8, 50 * zoom);
  const stepY = stepX / 2;
  const gridOrigin = origin
    ? { x: origin.x, y: origin.y - stepY }
    : center;
  const span = Math.ceil((size.width + size.height) / Math.max(1, stepX)) + 4;
  const vectorA = { x: stepX, y: stepY };
  const vectorB = { x: -stepX, y: stepY };
  const length = Math.ceil((size.width + size.height) / Math.max(1, stepX)) + 4;

  for (let i = -span; i <= span; i++) {
    const pointA = {
      x: gridOrigin.x + (vectorB.x * i),
      y: gridOrigin.y + (vectorB.y * i)
    };
    const pointB = {
      x: gridOrigin.x + (vectorA.x * i),
      y: gridOrigin.y + (vectorA.y * i)
    };

    lines.push(makeLine(pointA, vectorA, length));
    lines.push(makeLine(pointB, vectorB, length));
  }

  return {
    clipPoints: points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" "),
    lines
  };
}

function makeLine(point, vector, length) {
  return {
    x1: Math.round(point.x - (vector.x * length)),
    y1: Math.round(point.y - (vector.y * length)),
    x2: Math.round(point.x + (vector.x * length)),
    y2: Math.round(point.y + (vector.y * length))
  };
}

function calculateBounds(entries) {
  if (!entries.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

  const xs = entries.map((entry) => entry.iso.x);
  const ys = entries.map((entry) => entry.iso.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function firstImagePath(...paths) {
  return paths.find((path) => typeof path === "string" && path.trim().length > 0)
    ?? "icons/svg/mystery-man.svg";
}

function hasRegisteredIsoImage(token, registry = {}) {
  const tokenUuid = token?.document?.uuid;
  const actorUuid = token?.actor?.uuid ?? token?.document?.actor?.uuid;
  return Boolean(firstProvidedPath(registry[tokenUuid], registry[actorUuid]));
}

function firstProvidedPath(...paths) {
  return paths.find((path) => typeof path === "string" && path.trim().length > 0) ?? "";
}

function tokenFootprint(entry) {
  return entry.artMode === "iso" ? ISO_TOKEN_FOOTPRINT : FALLBACK_TOKEN_FOOTPRINT;
}

function largestFootprint(entries) {
  if (!entries.length) return ISO_TOKEN_FOOTPRINT;

  return entries
    .map(tokenFootprint)
    .reduce((largest, footprint) => ({
      width: Math.max(largest.width, footprint.width),
      aboveAnchor: Math.max(largest.aboveAnchor, footprint.aboveAnchor),
      belowAnchor: Math.max(largest.belowAnchor, footprint.belowAnchor)
    }), FALLBACK_TOKEN_FOOTPRINT);
}

function getTokenGridSize(token) {
  const width = tokenGridWidth(token);
  const height = tokenGridHeight(token);

  return {
    width,
    height,
    cells: Math.max(width, height, 1)
  };
}

function tokenGridWidth(token) {
  return positiveNumber(token?.document?.width ?? token?.width ?? (token?.w && gridSizeFromTokenPixels(token?.w)));
}

function tokenGridHeight(token) {
  return positiveNumber(token?.document?.height ?? token?.height ?? (token?.h && gridSizeFromTokenPixels(token?.h)));
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function gridSizeFromTokenPixels(value) {
  const gridSize = globalThis.canvas?.grid?.size ?? globalThis.canvas?.scene?.grid?.size ?? DEFAULT_GRID.size;
  return gridSize > 0 ? value / gridSize : 1;
}
