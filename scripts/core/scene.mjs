import { getOnlyBattleImageForToken, hasOnlyBattleImageSetting } from "./image-settings.mjs";

const DEFAULT_SCENE_SIZE = { width: 560, height: 340 };
const DEFAULT_GRID = { size: 100, distance: 5, units: "ft" };
const MIN_TOKEN_SCALE = 0.28;
const SCENE_PADDING = 18;
const FLOOR_RENDER_PADDING = 2;
const GRID_PLANE_FIT_CELLS = 3;
const ISO_PROJECTION_SCALE = 0.5;
const OVERLAY_GRID_SIZE = DEFAULT_GRID.size;
const ISO_TOKEN_FOOTPRINT = {
  width: 96,
  aboveAnchor: 76,
  belowAnchor: 20
};
const FALLBACK_TOKEN_FOOTPRINT = {
  width: 46,
  aboveAnchor: 46,
  belowAnchor: 8
};
const VIDEO_MEDIA_EXTENSIONS = new Set(["webm", "mp4", "m4v", "ogg", "ogv", "mov"]);

export function getIsoImageForToken(token, registry = {}) {
  return firstImagePath(
    getOnlyBattleImageForToken(token, registry, "iso"),
    token?.document?.texture?.src,
    token?.texture?.src,
    token?.document?.img,
    token?.actor?.prototypeToken?.texture?.src,
    token?.actor?.img,
    token?.document?.actor?.img
  );
}

export function getPortraitForToken(token, registry = {}) {
  return firstImagePath(
    getOnlyBattleImageForToken(token, registry, "portrait"),
    token?.actor?.img,
    token?.document?.actor?.img,
    token?.document?.texture?.src,
    token?.texture?.src,
    token?.document?.img,
    token?.actor?.prototypeToken?.texture?.src
  );
}

export function getCutinImageForToken(token, registry = {}, key = "cutin") {
  return firstImagePath(
    getOnlyBattleImageForToken(token, registry, key),
    getOnlyBattleImageForToken(token, registry, "cutin"),
    getPortraitForToken(token, registry)
  );
}

export function isVideoMediaPath(path) {
  if (typeof path !== "string") return false;
  const cleanPath = path.split(/[?#]/)[0].trim().toLowerCase();
  const extension = cleanPath.split(".").pop();
  return VIDEO_MEDIA_EXTENSIONS.has(extension);
}

export function projectCanvasToIso(point, origin, scale = ISO_PROJECTION_SCALE, gridSize = null) {
  const dx = (point?.x ?? 0) - (origin?.x ?? 0);
  const dy = (point?.y ?? 0) - (origin?.y ?? 0);
  const unitScale = Number.isFinite(gridSize) && gridSize > 0 ? OVERLAY_GRID_SIZE / gridSize : 1;
  const unitDx = dx * unitScale;
  const unitDy = dy * unitScale;

  return {
    x: (unitDx - unitDy) * scale,
    y: (unitDx + unitDy) * scale * 0.5
  };
}

export function getTokenGridCenter(token, grid = {}) {
  const gridSize = resolveGridSize(grid);
  const tokenX = token?.document?.x ?? token?.x;
  const tokenY = token?.document?.y ?? token?.y;
  const width = tokenGridWidth(token);
  const height = tokenGridHeight(token);

  if (Number.isFinite(tokenX) && Number.isFinite(tokenY) && gridSize > 0) {
    const gridCellCenter = getGridCellCenter({ x: tokenX, y: tokenY }, grid);
    if (gridCellCenter) {
      return {
        x: gridCellCenter.x + (((width - 1) * gridSize) / 2),
        y: gridCellCenter.y + (((height - 1) * gridSize) / 2)
      };
    }
    const topLeft = getSnappedTokenTopLeft({ x: tokenX, y: tokenY }, grid);
    return {
      x: topLeft.x + ((width * gridSize) / 2),
      y: topLeft.y + ((height * gridSize) / 2)
    };
  }

  return token?.center ?? { x: 0, y: 0 };
}

export function measureTokenDistance(source, target, grid = {}) {
  const sourceCenter = getTokenGridCenter(source, grid);
  const targetCenter = getTokenGridCenter(target, grid);
  const gridSize = resolveGridSize(grid);
  const gridDistance = resolveGridDistance(grid);
  const units = grid.units ?? globalThis.canvas?.scene?.grid?.units ?? DEFAULT_GRID.units;
  const measuredDistance = measureWithCanvasGrid(sourceCenter, targetCenter, grid);

  if (Number.isFinite(measuredDistance)) {
    return {
      value: Math.round(measuredDistance * 10) / 10,
      units
    };
  }

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
  const gridSize = resolveGridSize(grid);
  const rawProjected = participants.map(({ role, token }) => {
    const tokenCenter = getTokenGridCenter(token, grid);
    const tokenSize = getTokenGridSize(token);
    const baseIso = projectCanvasToIso(tokenCenter, origin, ISO_PROJECTION_SCALE, gridSize);
    const elevation = getTokenElevation(token);
    const elevationOffset = calculateElevationOffset(elevation, grid);
    const iso = {
      x: baseIso.x,
      y: baseIso.y - elevationOffset
    };
    const artMode = hasRegisteredIsoImage(token, registry) ? "iso" : "token";
    const img = getIsoImageForToken(token, registry);
    const portrait = getPortraitForToken(token, registry);
    const cutin = getCutinImageForToken(token, registry, "cutin");
    const criticalCutin = getCutinImageForToken(token, registry, "criticalCutin");
    const bloodiedCutin = getCutinImageForToken(token, registry, "bloodiedCutin");
    const unconsciousCutin = getCutinImageForToken(token, registry, "unconsciousCutin");
    return {
      id: token.document?.uuid ?? token.id ?? token.name,
      actorUuid: token.actor?.uuid ?? token.document?.actor?.uuid ?? "",
      name: token.name ?? token.actor?.name ?? "Token",
      role,
      img,
      isVideo: isVideoMediaPath(img),
      mediaType: isVideoMediaPath(img) ? "video" : "image",
      artMode,
      tokenArtHeight: tokenArtHeight(artMode),
      portrait,
      cutin,
      criticalCutin,
      bloodiedCutin,
      unconsciousCutin,
      portraitIsVideo: isVideoMediaPath(portrait),
      iso,
      baseIso,
      gridCenter: tokenCenter,
      gridSize,
      overlayGridSize: OVERLAY_GRID_SIZE,
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
  const sceneTokensWithoutFootprints = annotateSceneTokens(projected.map((entry) => sceneTokenFromProjected(entry, offset)), damageSummaries);
  const sourceAnchor = sceneTokensWithoutFootprints.find((token) => token.role === "source") ?? sceneTokensWithoutFootprints[0];
  const gridOrigin = sourceAnchor ? gridOriginForToken(sourceAnchor) : undefined;
  const sceneTokens = sceneTokensWithoutFootprints.map((entry) => ({
    ...entry,
    footprintCells: buildFootprintCellsForToken(entry, gridOrigin)
  }));
  const bloodied = sceneTokens.filter((token) => token.bloodied).map(portraitFromToken);
  const unconscious = sceneTokens.filter((token) => token.unconscious).map(portraitFromToken);
  const floorCells = buildFloorCells(sceneTokens);
  const flightLines = buildFlightLines(sceneTokens);
  const isoGrid = buildIsoGrid(size, {
    gridOrigin,
    zoom: fit.sceneScale,
    gridSize: OVERLAY_GRID_SIZE,
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
    unconscious,
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
    cutin: token.cutin,
    criticalCutin: token.criticalCutin,
    bloodiedCutin: token.bloodiedCutin,
    unconsciousCutin: token.unconsciousCutin,
    distance: token.distance,
    lane: portraitLane(token),
    damageText: token.damageText ?? "",
    hpText: token.hpText ?? "",
    bloodied: Boolean(token.bloodied),
    unconscious: Boolean(token.unconscious)
  };
}

function portraitLane(token) {
  return Number(token?.disposition) < 0 ? "enemy" : "ally";
}

function sceneTokenFromProjected(entry, offset) {
  const anchor = scenePoint(entry.iso, offset);
  const floor = scenePoint(entry.baseIso ?? entry.iso, offset);

  return {
    ...entry,
    anchor,
    floor,
    x: anchor.x,
    y: anchor.y,
    floorX: floor.x,
    floorY: floor.y,
    visualBounds: offsetVisualBounds(entry.visualBounds, offset)
  };
}

function scenePoint(point, offset) {
  return {
    x: roundCoordinate((point?.x ?? 0) + offset.x),
    y: roundCoordinate((point?.y ?? 0) + offset.y)
  };
}

function buildFloorCells(tokens) {
  return tokens.flatMap((token) => token.footprintCells ?? buildFootprintCellsForToken(token));
}

function buildFootprintCellsForToken(token, gridOrigin = gridOriginForToken(token)) {
    const width = Math.max(1, Math.ceil(token.size?.width ?? 1));
    const height = Math.max(1, Math.ceil(token.size?.height ?? 1));
    const centerOffsetX = (width - 1) / 2;
    const centerOffsetY = (height - 1) / 2;
    const basis = gridBasisForToken(token, gridOrigin);
    const cells = [];

    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const cellBasis = {
          u: basis.u + (column - centerOffsetX) - 0.5,
          v: basis.v + (row - centerOffsetY) - 0.5
        };
        cells.push({
          tokenId: token.id,
          role: token.role,
          lane: portraitLane(token),
          rect: {
            u: roundCoordinate(cellBasis.u),
            v: roundCoordinate(cellBasis.v),
            width: 1,
            height: 1
          },
          points: gridCellPoints(cellBasis, {
            origin: gridOrigin,
            stepX: token.gridStepX,
            stepY: token.gridStepY
          })
        });
      }
    }

    return cells;
}

function gridOriginForToken(token) {
  return {
    x: token.floor.x,
    y: token.floor.y - token.gridStepY
  };
}

function gridBasisForToken(token, gridOrigin) {
  return toIsoBasis(token.floor, {
    origin: gridOrigin,
    stepX: token.gridStepX,
    stepY: token.gridStepY
  });
}

function gridCellPoints(cellBasis, basis) {
  return [
    fromIsoBasis({ u: cellBasis.u, v: cellBasis.v }, basis),
    fromIsoBasis({ u: cellBasis.u + 1, v: cellBasis.v }, basis),
    fromIsoBasis({ u: cellBasis.u + 1, v: cellBasis.v + 1 }, basis),
    fromIsoBasis({ u: cellBasis.u, v: cellBasis.v + 1 }, basis)
  ].map((point) => `${formatCoordinate(point.x)},${formatCoordinate(point.y)}`).join(" ");
}

function buildFlightLines(tokens) {
  return tokens
    .filter((token) => token.elevation > 0 && token.anchor.y < token.floor.y)
    .map((token) => ({
      tokenId: token.id,
      role: token.role,
      lane: portraitLane(token),
      x1: token.floor.x,
      y1: token.floor.y,
      x2: token.anchor.x,
      y2: token.anchor.y
    }));
}

function annotateSceneTokens(tokens, summaries = []) {
  if (!summaries?.length) {
    return tokens.map((token) => ({
      ...token,
      damageText: "",
      hpText: "",
      bloodied: false,
      unconscious: false
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
      bloodied: Boolean(summary?.bloodied),
      unconscious: Boolean(summary?.unconscious)
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
    gridStepX: roundScale((entry.overlayGridSize ?? OVERLAY_GRID_SIZE) * ISO_PROJECTION_SCALE * sceneScale),
    gridStepY: roundScale((entry.overlayGridSize ?? OVERLAY_GRID_SIZE) * ISO_PROJECTION_SCALE * 0.5 * sceneScale),
    labelTop: Math.round(8 * tokenScale * (entry.sizeScale ?? 1)),
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
  if (gridDistance <= 0) return 0;
  return (elevation / gridDistance) * OVERLAY_GRID_SIZE * ISO_PROJECTION_SCALE * 0.5;
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
  const floorHalfWidth = ((((entry.size?.width ?? 1) + (entry.size?.height ?? 1)) * (entry.gridStepX ?? 0)) / 2)
    + ((entry.gridStepX ?? 0) * GRID_PLANE_FIT_CELLS)
    + FLOOR_RENDER_PADDING;
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

function roundCoordinate(value) {
  return Math.round(Number(value ?? 0) * 1000) / 1000;
}

function formatCoordinate(value) {
  return String(roundCoordinate(value));
}

function buildIsoGrid(size, { gridOrigin = null, zoom = 1, gridSize = DEFAULT_GRID.size, floorCells = [] } = {}) {
  const center = { x: size.width / 2, y: size.height / 2 + 8 };
  const stepX = Math.max(8, gridSize * ISO_PROJECTION_SCALE * zoom);
  const stepY = stepX / 2;
  const origin = gridOrigin ?? center;
  const rect = gridRectFromFloorCells(floorCells, { margin: 2 });
  const cells = buildGridCellsFromRect(rect, {
    origin,
    stepX,
    stepY
  });
  const clipPoints = gridClipPointsFromRect(rect, { origin, stepX, stepY });

  return {
    stepX: Math.round(stepX * 1000) / 1000,
    stepY: Math.round(stepY * 1000) / 1000,
    origin,
    clipPoints,
    cells,
    lines: []
  };
}

function gridRectFromFloorCells(floorCells, { margin = 2 } = {}) {
  const rects = floorCells.map((cell) => cell.rect).filter(Boolean);
  if (!rects.length) {
    return { minU: -3, minV: -3, maxU: 3, maxV: 3 };
  }

  return {
    minU: Math.floor(Math.min(...rects.map((rect) => rect.u)) - margin),
    minV: Math.floor(Math.min(...rects.map((rect) => rect.v)) - margin),
    maxU: Math.ceil(Math.max(...rects.map((rect) => rect.u + rect.width)) + margin),
    maxV: Math.ceil(Math.max(...rects.map((rect) => rect.v + rect.height)) + margin)
  };
}

function buildGridCellsFromRect(rect, basis) {
  const cells = [];
  for (let u = rect.minU; u < rect.maxU; u++) {
    for (let v = rect.minV; v < rect.maxV; v++) {
      cells.push({
        u,
        v,
        points: gridCellPoints({ u, v }, basis)
      });
    }
  }
  return cells;
}

function gridClipPointsFromRect(rect, basis) {
  return [
    fromIsoBasis({ u: rect.minU, v: rect.minV }, basis),
    fromIsoBasis({ u: rect.maxU, v: rect.minV }, basis),
    fromIsoBasis({ u: rect.maxU, v: rect.maxV }, basis),
    fromIsoBasis({ u: rect.minU, v: rect.maxV }, basis)
  ].map((point) => `${formatCoordinate(point.x)},${formatCoordinate(point.y)}`).join(" ");
}

function toIsoBasis(point, { stepX, stepY, origin = { x: 0, y: 0 } }) {
  const x = Number(point?.x ?? 0) - Number(origin?.x ?? 0);
  const y = Number(point?.y ?? 0) - Number(origin?.y ?? 0);
  return {
    u: ((y / stepY) + (x / stepX)) / 2,
    v: ((y / stepY) - (x / stepX)) / 2
  };
}

function fromIsoBasis(point, { stepX, stepY, origin = { x: 0, y: 0 } }) {
  return {
    x: ((point.u - point.v) * stepX) + Number(origin?.x ?? 0),
    y: ((point.u + point.v) * stepY) + Number(origin?.y ?? 0)
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

function resolveGridSize(grid = {}) {
  const canvasGrid = resolveCanvasGrid(grid);
  return positiveNumber(grid.gridSize ?? grid.size ?? canvasGrid?.size ?? globalThis.canvas?.grid?.size
    ?? globalThis.canvas?.scene?.grid?.size
    ?? DEFAULT_GRID.size);
}

function resolveGridDistance(grid = {}) {
  const canvasGrid = resolveCanvasGrid(grid);
  return positiveNumber(grid.gridDistance ?? grid.distance ?? canvasGrid?.distance ?? globalThis.canvas?.scene?.grid?.distance
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
  return hasOnlyBattleImageSetting(token, registry, "iso");
}

function firstProvidedPath(...paths) {
  return paths.find((path) => typeof path === "string" && path.trim().length > 0) ?? "";
}

function tokenFootprint(entry) {
  return entry.artMode === "iso" ? ISO_TOKEN_FOOTPRINT : FALLBACK_TOKEN_FOOTPRINT;
}

function tokenArtHeight(artMode) {
  return artMode === "iso" ? ISO_TOKEN_FOOTPRINT.aboveAnchor : FALLBACK_TOKEN_FOOTPRINT.aboveAnchor;
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
  const gridSize = resolveGridSize();
  return gridSize > 0 ? value / gridSize : 1;
}

function getSnappedTokenTopLeft(point, grid = {}) {
  const canvasGrid = resolveCanvasGrid(grid);
  if (!canvasGrid?.getSnappedPoint || canvasGrid.isGridless) return point;

  try {
    const mode = globalThis.CONST?.GRID_SNAPPING_MODES?.TOP_LEFT_CORNER ?? 0x100;
    const snapped = canvasGrid.getSnappedPoint(point, { mode, resolution: 1 });
    if (Number.isFinite(snapped?.x) && Number.isFinite(snapped?.y)) {
      return { x: snapped.x, y: snapped.y };
    }
  } catch (_error) {
    // Older Foundry builds or custom grids may not accept the v13 snapping behavior object.
  }

  return point;
}

function getGridCellCenter(point, grid = {}) {
  const canvasGrid = resolveCanvasGrid(grid);
  if (!canvasGrid?.getCenterPoint || canvasGrid.isGridless) return null;

  try {
    const center = canvasGrid.getCenterPoint(point);
    if (Number.isFinite(center?.x) && Number.isFinite(center?.y)) {
      return { x: center.x, y: center.y };
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function measureWithCanvasGrid(sourceCenter, targetCenter, grid = {}) {
  const canvasGrid = resolveCanvasGrid(grid);
  if (!canvasGrid?.measurePath || canvasGrid.isGridless) return null;

  try {
    const result = canvasGrid.measurePath([sourceCenter, targetCenter]);
    return Number.isFinite(result?.distance) ? result.distance : null;
  } catch (_error) {
    return null;
  }
}

function resolveCanvasGrid(grid = {}) {
  if (grid?.getSnappedPoint || grid?.getCenterPoint || grid?.measurePath) return grid;
  return grid?.api ?? grid?.canvasGrid ?? globalThis.canvas?.grid ?? null;
}
