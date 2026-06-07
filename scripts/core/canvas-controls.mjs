export function captureCanvasToolState(controls = globalThis.ui?.controls) {
  const active = controls?.active ?? {};
  const control = active.control
    ?? active.name
    ?? controls?.control?.name
    ?? controls?.control
    ?? controls?.activeControl
    ?? controls?._activeControl
    ?? "";
  const tool = active.tool
    ?? controls?.tool?.name
    ?? controls?.tool
    ?? controls?.activeTool
    ?? controls?._activeTool
    ?? "";

  return {
    control,
    tool
  };
}

export async function activateCanvasTargetTool({
  controls = globalThis.ui?.controls,
  tokenLayer = globalThis.canvas?.tokens
} = {}) {
  const previous = captureCanvasToolState(controls);

  if (!tokenLayer?.active) await tokenLayer?.activate?.();

  const targetState = resolveTokenToolState(controls, "target");
  if (targetState && typeof controls?.activate === "function") {
    await controls.activate(targetState);
  }

  return previous;
}

export async function restoreCanvasToolState(previous, {
  controls = globalThis.ui?.controls
} = {}) {
  const toolState = isUsableToolState(previous)
    ? previous
    : resolveTokenToolState(controls, "select");

  if (!toolState || typeof controls?.activate !== "function") return false;

  await controls.activate(toolState);
  return true;
}

function resolveTokenToolState(controls, toolName) {
  const tokenControl = controls?.controls?.tokens
    ?? Array.from(controls?.controls ?? []).find?.((control) => control?.name === "tokens");
  const tool = tokenControl?.tools?.[toolName]
    ?? Array.from(tokenControl?.tools ?? []).find?.((entry) => entry?.name === toolName);

  if (!tokenControl?.name || !tool?.name) return null;

  return {
    control: tokenControl.name,
    tool: tool.name
  };
}

function isUsableToolState(toolState) {
  return Boolean(toolState?.control && toolState?.tool);
}
