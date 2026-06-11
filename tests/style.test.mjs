import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("isometric token images ignore host max-width rules", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const rule = css.match(/\.onlybattle-iso-token img,\s*\.onlybattle-iso-token video\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(rule, /max-width:\s*none;/);
  assert.match(rule, /max-height:\s*none;/);
});

test("isometric token videos use the same sizing safeguards as token images", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const rule = css.match(/\.onlybattle-iso-token img,\s*\.onlybattle-iso-token video\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(rule, /max-width:\s*none;/);
  assert.match(rule, /max-height:\s*none;/);
});

test("target dialog token videos use the same preview sizing as token images", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const rule = css.match(/\.onlybattle-target-list img,\s*\.onlybattle-target-list video\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(rule, /width:\s*32px;/);
  assert.match(rule, /height:\s*32px;/);
  assert.match(rule, /object-fit:\s*cover;/);
});

test("target dialog renders selected token videos as muted looping media", () => {
  const template = fs.readFileSync("templates/target-dialog.hbs", "utf8");

  assert.match(template, /{{#if isVideo}}/);
  assert.match(template, /<video src="{{img}}"[^>]*autoplay loop muted playsinline>/);
});

test("combat portraits stay as side stacks while event cut-ins use top and bottom rails", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const template = fs.readFileSync("templates/combat-overlay.hbs", "utf8");
  const frameRule = css.match(/\.onlybattle-combat-frame\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const cutinRule = css.match(/\.onlybattle-event-cutin\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.doesNotMatch(frameRule, /flex-direction:\s*column;/);
  assert.match(template, /scene\.portraits\.source/);
  assert.match(template, /onlybattle-combat-portrait-stack-source/);
  assert.match(template, /scene\.portraits\.targets/);
  assert.match(template, /onlybattle-combat-portrait-stack-target/);
  assert.match(template, /cutins\.enemies/);
  assert.match(template, /cutins\.allies/);
  assert.match(cutinRule, /min-height:\s*124px;/);
});

test("cinematic cut-ins render as a large battle overlay layer", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const template = fs.readFileSync("templates/combat-overlay.hbs", "utf8");
  const layerRule = css.match(/\.onlybattle-cinematic-cutin\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const allyRule = css.match(/\.onlybattle-cinematic-ally\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const cinematicBlock = template.match(/\{\{#if cinematicCutin\}\}(?<body>[\s\S]+?)\{\{\/if\}\}/)?.groups?.body ?? "";

  assert.match(template, /cinematicCutin/);
  assert.match(template, /onlybattle-cinematic-cutin/);
  assert.match(template, /onlybattle-cinematic-\{\{stage\}\}/);
  assert.match(layerRule, /position:\s*absolute;/);
  assert.match(layerRule, /width:\s*100vw;/);
  assert.match(allyRule, /bottom:\s*calc\(50% - 50vh\);/);
  assert.match(layerRule, /pointer-events:\s*none;/);
  assert.doesNotMatch(cinematicBlock, /onlybattle-cinematic-title/);
  assert.doesNotMatch(cinematicBlock, /\{\{localize label\}\}/);
});

test("critical outcomes have a distinct badge animation", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const criticalRule = css.match(/\.onlybattle-outcome-critical\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(criticalRule, /onlybattle-critical-badge/);
});

test("miss and damage outcome badges use distinct lightweight animations", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const missRule = css.match(/\.onlybattle-outcome-miss\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const damageRule = css.match(/\.onlybattle-outcome-damage\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(missRule, /onlybattle-miss-badge/);
  assert.match(damageRule, /onlybattle-damage-badge/);
});

test("occupied floor cells are visible enough to read token placement", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const floorRule = css.match(/\.onlybattle-floor-cell\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const allyRule = css.match(/\.onlybattle-floor-cell-ally\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const enemyRule = css.match(/\.onlybattle-floor-cell-enemy\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(floorRule, /stroke:\s*none;/);
  assert.match(allyRule, /rgba\(79,\s*214,\s*126,\s*0\.[34]\d*\)/);
  assert.match(enemyRule, /rgba\(255,\s*76,\s*90,\s*0\.[34]\d*\)/);
  assert.doesNotMatch(allyRule, /stroke:/);
  assert.doesNotMatch(enemyRule, /stroke:/);
});

test("combat token art keeps its natural aspect ratio instead of using fallback boxes", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const rule = css.match(/\.onlybattle-iso-token img,\s*\.onlybattle-iso-token video\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const fallbackRule = css.match(/\.onlybattle-iso-token\.onlybattle-art-token img,\s*\.onlybattle-iso-token\.onlybattle-art-token video\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(rule, /bottom:\s*0;/);
  assert.match(rule, /width:\s*auto;/);
  assert.match(rule, /height:\s*var\(--onlybattle-token-art-height\);/);
  assert.match(rule, /object-fit:\s*contain;/);
  assert.match(rule, /transform:\s*translateX\(-50%\)/);
  assert.doesNotMatch(css, /onlybattle-token-stand-/);
  assert.match(fallbackRule, /scale\(var\(--onlybattle-token-scale\)\)/);
  assert.doesNotMatch(rule, /border-radius:/);
  assert.doesNotMatch(rule, /object-fit:\s*cover;/);
  assert.doesNotMatch(rule, /border-radius:\s*50%;/);
  assert.doesNotMatch(rule, /translate\(-50%,\s*-50%\)/);
});

test("combat overlay positions tokens from scene-space anchors", () => {
  const template = fs.readFileSync("templates/combat-overlay.hbs", "utf8");

  assert.match(template, /left:\s*{{anchor\.x}}px;/);
  assert.match(template, /top:\s*{{anchor\.y}}px;/);
  assert.doesNotMatch(template, /left:\s*{{x}}px;/);
  assert.doesNotMatch(template, /top:\s*{{y}}px;/);
});
