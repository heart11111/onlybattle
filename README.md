# OnlyBattle

OnlyBattle is a Foundry VTT module for dnd5e combat. It adds a targeting gate and a lightweight isometric combat overlay on top of midi-qol without replacing dnd5e or midi-qol rolling, hit detection, or damage application.

## Current Scope

- Requires Foundry VTT v13 and `midi-qol`.
- Uses midi-qol workflow hooks for attacks, saves, and area/template targeting.
- Treats `midi-qol` as the supported workflow engine, not an optional enhancement.
- Does not wrap dnd5e Activity methods or require `lib-wrapper`.
- Uses an OnlyBattle targeting dialog by default instead of midi-qol Target Confirmation.
- Provides a setting to also show midi-qol Target Confirmation after OnlyBattle targeting.
- Displays a DOM/CSS combat overlay after attack or damage roll flow starts.
- Stores separate isometric Actor/Token image mappings in a world setting.
- Falls back to the normal Foundry token image when no isometric mapping exists.

## Local Testing

This repository is intended to live at:

```text
C:\Users\sj\AppData\Local\FoundryVTT\Data\modules\onlybattle
```

Run static tests with:

```bash
npm test
```

## Code Map

- `scripts/onlybattle.mjs`: Foundry entry point. Registers settings and midi-qol hooks after dependency checks.
- `scripts/wrappers.mjs`: midi-qol pre-targeting integration. This is where OnlyBattle decides whether to open its targeting dialog.
- `scripts/overlay-manager.mjs`: ApplicationV2 combat overlay lifecycle. It only coordinates state and rendering.
- `scripts/core/workflow-view.mjs`: Converts midi-qol workflow data into overlay title, targets, outcome, and damage type.
- `scripts/core/workflow-filter.mjs`: Filters CPR-style synthetic workflows, automation-only flows, and ordinary player workflows.
- `scripts/core/scene.mjs`: Lightweight isometric scene projection, token grid-center math, auto-scaling, portraits, and fallback token art.
- `scripts/core/template-targeting.mjs`: Measured template placement and target collection for area activities.
- `scripts/core/collections.mjs`: Shared collection helpers used by workflow and targeting code.
- `scripts/settings.mjs` and `scripts/registry-app.mjs`: World settings and isometric token image registry.

## Design Constraints

- Keep dnd5e and midi-qol as the source of truth for rolls, hit checks, saves, and damage application.
- Do not call Sequencer, Automated Animations, or JB2A from OnlyBattle; those modules can run independently.
- Prefer midi-qol workflow hooks over wrapping dnd5e internals.
- Keep the overlay DOM/CSS based until a later asset/rendering pass needs PIXI.
- Treat token placement as grid-center based: `TokenDocument.x/y + width/height * gridSize / 2`.
