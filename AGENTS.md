# AGENTS.md

## Project

- Node.js package.

## Package manager

- Use `npm` for this workspace. The lockfile is `package-lock.json`.
- Run package scripts with `npm run <script>`.

## Architecture

- Project: myfrem.friuliemergenze.it.

## Source entry points

- `index.html` (571 lines) — ES module script, loads scripts.

## Comment style

- Never place comments on the first two lines of a source file; start with imports or declarations.
- Prefer concise section headings such as `// ── Constants ──` or a three-line banner for major sections so files remain easy to scan.
- Use JSDoc blocks only when an API, intent, edge case, or constraint needs explanation; do not restate the code.

## Caveats

- No linter detected — no `lint` script, no ESLint config.
- No test runner configured — no `test` script or test config found.
- No formatter detected — no Prettier config or format script.
- `node_modules/` is not listed in `.gitignore`.

## Unused or duplicate files

- `replace.js` — not referenced in `index.html`.

## Boundaries

- Prefer existing local patterns and helper APIs before adding new abstractions.
- Keep generated, packaged, and runtime asset boundaries intact; do not move files across host/webview ownership without updating build and packaging config.
