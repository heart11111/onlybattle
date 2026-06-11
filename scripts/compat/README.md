# Compatibility Bridges

This folder contains optional integration layers for other Foundry modules.

Rules for this folder:

- Do not copy implementation code from external modules.
- Prefer public hooks, public module APIs, and lightweight data adapters.
- Keep compatibility code optional; OnlyBattle should keep working when the
  related module is missing or disabled.
- If a bridge cannot resolve enough public data to render safely, leave the
  original module workflow untouched.
- Keep module-specific assumptions in this folder instead of spreading them
  through the core overlay, targeting, or scene code.
