const DEFAULT_SCENE_SIZE = { width: 560, height: 340 };
const DEFAULT_GRID = { size: 100, distance: 5, units: "ft" };
const MIN_TOKEN_SCALE = 0.28;
const SCENE_PADDING = 18;
const ISO_PROJECTION_SCALE = 0.5;
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
const VIDEO_MEDIA_EXTENSIONS = new Set(["webm", "mp4", "m4v", "ogg", "ogv", "mov"]);

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

export function isVideoMediaPath(path) {
  if (typeof path !== "string") return false;
  const cleanPath = path.split(/[?#]/)[0].trim().toLowerCase();
  const extension = cleanPath.split(".").pop();
  return VIDEO_MEDIA_EXTENSIONS.has(extension);
}

export function projectCanvasToIso(point, origin, scale = ISO_PROJECTION_SCALE) {
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
  grid = {},
  damageSummaries = []
} = {}) {
  const participants = [
    { role: "source", token: source },
    ...targets.filter(Boolean).map((target) => ({ role: "target", token: target }))
  ].filter((entry) => entry.token);

  const origin = source ? getTokenGridCenter(source, grid) : getTokenGridCenter(participants[0]?.token, grid);
  const rawProjected = participants.map(({ role, token }) => {
    const tokenCenter = getTokenGridCenter(token, grid);
    const tokenSize = getTokenGridSize(token);
    const baseIso = projectCanvasToIso(tokenCenter, origin);
    const elevation = getTokenElevation(token);
    const elevationOffset = calculateElevationOffset(elevation, grid);
    const iso = {
      x: baseIso.x,
      y: baseIso.y - elevationOffset
    };
    const artMode = hasRegisteredIsoImage(token, registry) ? "iso" : "token";
    const img = getIsoImageForToken(token, registry);
    const portrait = getPortraitForToken(token);
    const gridSize = resolveGridSize(grid);
    return {
      id: token.document?.uuid ?? token.id ?? token.name,
      actorUuid: token.actor?.uuid ?? token.document?.actor?.uuid ?? "",
      name: token.name ?? token.actor?.name ?? "Token",
      role,
      img,
      isVideo: isVideoMediaPath(img),
      mediaType: isVideoMediaPath(img) ? "video" : "image",
      artMode,
      portrait,
      portraitIsVideo: isVideoMediaPath(portrait),
      iso,
      baseIso,
      gridCenter: tokenCenter,
      gridSize,
      size: tokenSize,
      sizeScale: tokenSize.cells,
      elevation,
      elevationOffset,
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
  const sceneTokens = annotateSceneTokens(projected.map((entry) => ({
    ...entry,
    x: Math.round(entry.iso.x + offset.x),
    y: Math.round(entry.iso.y + offset.y),
    floorX: Math.round((entry.baseIso?.x ?? entry.iso.x) + offset.x),
    floorY: Math.round((entry.baseIso?.y ?? entry.iso.y) + offset.y),
    visualBounds: offsetVisualBounds(entry.visualBounds, offset)
  })), damageSummaries);
  const sourceAnchor = sceneTokens.find((token) => token.role === "source") ?? sceneTokens[0];
  const bloodied = sceneTokens.filter((token) => token.bloodied).map(portraitFromToken);
  const floorCells = buildFloorCells(sceneTokens);
  const flightLines = buildFlightLines(sceneTokens);
  const isoGrid = buildIsoGrid(size, {
    origin: sourceAnchor ? { x: sourceAnchor.floorX ?? sourceAnchor.x, y: sourceAnchor.floorY ?? sourceAnchor.y } : undefined,
    zoom: fit.sceneScale,
    gridSize: resolveGridSize(grid),
    floorCells
  });

  return {
    size,
    zoom: fit.sceneScale,
    grid: isoGrid,
    bounds,
    floorCells,
    flightLines,
    portraits: buildPortraits(sceneTokens),
    bloodied,
    tokens: sceneTokens
  };
}

function buildPortraits(tokens) {
  const source = tokens.find((token) => token.role === "source");
  const targets = tokens.filter((token) => token.role === "target");

  return {
    source: source ? portraitFromToken(source) : null,
    target: targets[0] ? portraitFromToken(targets[0]) : null,
    targets: targets.map(portraitFromToken),
    allies: tokens.filter((token) => portraitLane(token) === "ally").map(portraitFromToken),
    enemies: tokens.filter((token) => portraitLane(token) === "enemy").map(portraitFromToken)
  };
}

function portraitFromToken(token) {
  return {
    id: token.id,
    name: token.name,
    img: token.portrait,
    isVideo: isVideoMediaPath(token.portrait),
    mediaType: isVideoMediaPath(token.portrait) ? "video" : "image",
    distance: token.distance,
    lane: portraitLane(token),
    damageText: token.damageText ?? "",
    hpText: token.hpText ?? "",
    bloodied: Boolean(token.bloodied)
  };
}

function portraitLane(token) {
  return Number(token?.disposition) < 0 ? "enemy" : "ally";
}

function buildFloorCells(tokens) {
  return tokens.flatMap((token) => {
    const width = Math.max(1, Math.ceil(token.size?.width ?? 1));
    const height = Math.max(1, Math.ceil(token.size?.height ?? 1));
    const centerOffsetX = (width - 1) / 2;
    const centerOffsetY = (height - 1) / 2;
    const cells = [];

    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const canvasOffset = {
          x: (column - centerOffsetX) * token.gridSize,
          y: (row - centerOffsetY) * token.gridSize
        };
        const isoOffset = projectCanvasToIso(canvasOffset, { x: 0, y: 0 });
        const center = {
          x: token.floorX + (isoOffset.x * token.sceneScale),
          y: token.floorY + (isoOffset.y * token.sceneScale)
        };
        cells.push({
          tokenId: token.id,
          role: token.role,
          lane: portraitLane(token),
          points: floorCellPoints(center, token.gridStepX, token.gridStepY)
        });
      }
    }

    return cells;
  });
}

function floorCellPoints(center, stepX, stepY) {
  return [
    { x: center.x, y: center.y - stepY },
    { x: center.x + stepX, y: center.y },
    { x: center.x, y: center.y + stepY },
    { x: center.x - stepX, y: center.y }
  ].map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" ");
}

function buildFlightLines(tokens) {
  return tokens
    .filter((token) => token.elevation > 0 && token.y < token.floorY)
    .map((token) => ({
      tokenId: token.id,
      role: token.role,
      lane: portraitLane(token),
      x1: token.floorX,
      y1: token.floorY,
      x2: token.x,
      y2: token.y
    }));
}

function annotateSceneTokens(tokens, summaries = []) {
  if (!summaries?.length) {
    return tokens.map((token) => ({
      ...token,
      damageText: "",
      hpText: "",
      bloodied: false
    }));
  }

  return tokens.map((token) => {
    const summary = summaries.find((entry) => {
      const tokenUuid = token.id;
      return (entry.tokenUuid && entry.tokenUuid === tokenUuid)
        || (entry.actorUuid && entry.actorUuid === token.actorUuid);
    });

    return {
      ...token,
      damageText: summary?.damageText ?? "",
      hpText: summary?.hpText ?? "",
      bloodied: Boolean(summary?.bloodied)
    };
  });
}

function fitProjectedTokens(entries, size) {
  if (!entries.length) return { entries, sceneScale: 1 };

  const bounds = calculateBounds(entries);
  const sceneScale = calculateSceneScale(entries, bounds, size);
  const scaledEntries = entries.map((entry) => scaleProjectedEntry(entry, sceneScale));

  return {
    entries: scaledEntries,
    sceneScale
  };
}

function calculateSceneScale(entries, bounds, size) {
  let sceneScale = 1;
  const availableWidth = Math.max(80, size.width - (SCENE_PADDING * 2));
  const availableHeight = Math.max(80, size.height - (SCENE_PADDING * 2));

  for (let i = 0; i < 8; i++) {
    const scaledEntries = entries.map((entry) => scaleProjectedEntry(entry, sceneScale));
    const visualBounds = calculateVisualBounds(scaledEntries);
    const nextScale = Math.min(
      1,
      visualBounds.width > 0 ? availableWidth / visualBounds.width : 1,
      visualBounds.height > 0 ? availableHeight / visualBounds.height : 1
    );

    if (nextScale >= 1) break;
    sceneScale = roundScale(Math.max(0.01, sceneScale * nextScale));
  }

  return roundScale(sceneScale);
}

function scaleProjectedEntry(entry, sceneScale) {
  const tokenScale = calculateTokenScale(sceneScale);
  const next = {
    ...entry,
    scale: tokenScale,
    sceneScale,
    gridStepX: roundScale((entry.gridSize ?? DEFAULT_GRID.size) * ISO_PROJECTION_SCALE * sceneScale),
    gridStepY: roundScale((entry.gridSize ?? DEFAULT_GRID.size) * ISO_PROJECTION_SCALE * 0.5 * sceneScale),
    iso: {
      x: entry.iso.x * sceneScale,
      y: entry.iso.y * sceneScale
    },
    baseIso: {
      x: entry.baseIso.x * sceneScale,
      y: entry.baseIso.y * sceneScale
    }
  };

  return {
    ...next,
    visualBounds: calculateTokenVisualBounds(next)
  };
}

function calculateElevationOffset(elevation, grid = {}) {
  if (!Number.isFinite(elevation) || elevation <= 0) return 0;
  const gridDistance = resolveGridDistance(grid);
  const gridSize = resolveGridSize(grid);
  if (gridDistance <= 0) return 0;
  return (elevation / gridDistance) * gridSize * ISO_PROJECTION_SCALE * 0.5;
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
  const baseIso = entry.baseIso ?? entry.iso;
  const floorHalfWidth = (((entry.size?.width ?? 1) + (entry.size?.height ?? 1)) * (entry.gridStepX ?? 0)) / 2;
  const floorHalfHeight = floorHalfWidth / 2;
  return {
    left: Math.min(entry.iso.x - halfWidth, baseIso.x - floorHalfWidth),
    right: Math.max(entry.iso.x + halfWidth, baseIso.x + floorHalfWidth),
    top: Math.min(entry.iso.y - (footprint.aboveAnchor * totalScale), baseIso.y - floorHalfHeight),
    bottom: Math.max(entry.iso.y + (footprint.belowAnchor * totalScale), baseIso.y + floorHalfHeight)
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

function buildIsoGrid(size, { origin, zoom = 1, gridSize = DEFAULT_GRID.size, floorCells = [] } = {}) {
  const center = { x: size.width / 2, y: size.height / 2 + 8 };
  const radius = { x: size.width * 0.48, y: size.height * 0.43 };
  const defaultPoints = [
    { x: center.x, y: center.y - radius.y },
    { x: center.x + radius.x, y: center.y },
    { x: center.x, y: center.y + radius.y },
    { x: center.x - radius.x, y: center.y }
  ];
  const lines = [];
  const stepX = Math.max(8, gridSize * ISO_PROJECTION_SCALE * zoom);
  const stepY = stepX / 2;
  const points = isoClipPointsFromFloorCells(floorCells, { stepX, stepY }) ?? defaultPoints;
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
    stepX: Math.round(stepX * 1000) / 1000,
    stepY: Math.round(stepY * 1000) / 1000,
    clipPoints: points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" "),
    lines
  };
}

function isoClipPointsFromFloorCells(floorCells, { stepX, stepY }) {
  const points = floorCells.flatMap((cell) => parsePointList(cell.points));
  if (!points.length || stepX <= 0 || stepY <= 0) return null;

  const coords = points.map((point) => toIsoBasis(point, { stepX, stepY }));
  const margin = 1.15;
  const minU = Math.min(...coords.map((point) => point.u)) - margin;
  const maxU = Math.max(...coords.map((point) => point.u)) + margin;
  const minV = Math.min(...coords.map((point) => point.v)) - margin;
  const maxV = Math.max(...coords.map((point) => point.v)) + margin;

  return [
    fromIsoBasis({ u: minU, v: minV }, { stepX, stepY }),
    fromIsoBasis({ u: maxU, v: minV }, { stepX, stepY }),
    fromIsoBasis({ u: maxU, v: maxV }, { stepX, stepY }),
    fromIsoBasis({ u: minU, v: maxV }, { stepX, stepY })
  ];
}

function toIsoBasis(point, { stepX, stepY }) {
  const x = Number(point?.x ?? 0);
  const y = Number(point?.y ?? 0);
  return {
    u: ((y / stepY) + (x / stepX)) / 2,
    v: ((y / stepY) - (x / stepX)) / 2
  };
}

function fromIsoBasis(point, { stepX, stepY }) {
  return {
    x: (point.u - point.v) * stepX,
    y: (point.u + point.v) * stepY
  };
}

function parsePointList(points) {
  if (typeof points !== "string") return [];
  return points.split(" ")
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    })
    .filter(Boolean);
}

function makeLine(point, vector, length) {
  return {
    x1: Math.round(point.x - (vector.x * length)),
    y1: Math.round(point.y - (vector.y * length)),
    x2: Math.round(point.x + (vector.x * length)),
    y2: Math.round(point.y + (vector.y * length))
  };
}

function resolveGridSize(grid = {}) {
  return positiveNumber(grid.gridSize ?? grid.size ?? globalThis.canvas?.grid?.size
    ?? globalThis.canvas?.scene?.grid?.size
    ?? DEFAULT_GRID.size);
}

function resolveGridDistance(grid = {}) {
  return positiveNumber(grid.gridDistance ?? grid.distance ?? globalThis.canvas?.scene?.grid?.distance
    ?? DEFAULT_GRID.distance);
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

function getTokenElevation(token) {
  const elevation = Number(token?.document?.elevation ?? token?.elevation ?? 0);
  return Number.isFinite(elevation) ? Math.max(0, elevation) : 0;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function gridSizeFromTokenPixels(value) {
  const gridSize = globalThis.canvas?.grid?.size ?? globalThis.canvas?.scene?.grid?.size ?? DEFAULT_GRID.size;
  return gridSize > 0 ? value / gridSize : 1;
}
