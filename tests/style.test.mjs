import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("isometric token images ignore host max-width rules", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const rule = css.match(/\.onlybattle-iso-token img\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(rule, /max-width:\s*none;/);
  assert.match(rule, /max-height:\s*none;/);
});

test("miss and damage outcome badges use distinct lightweight animations", () => {
  const css = fs.readFileSync("styles/onlybattle.css", "utf8");
  const missRule = css.match(/\.onlybattle-outcome-miss\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";
  const damageRule = css.match(/\.onlybattle-outcome-damage\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? "";

  assert.match(missRule, /onlybattle-miss-badge/);
  assert.match(damageRule, /onlybattle-damage-badge/);
});
