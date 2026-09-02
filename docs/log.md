# Documentation log

Newest first. Add an entry whenever any document in this bundle, or a root guide, changes.

## 2026-09-02

- Installed the LogHosp OKF documentation map (OKF v0.2) on branch `docs/okf-doc-map`. Created the
  root guides `ARCHITECTURE.md`, `CONTRIBUTING.md`, `INFRA.md` and `SECURITY.md`; slimmed the three
  `README.md` copies to the public API plus links, moving the licence discipline into
  `CONTRIBUTING.md` and the prior-art URLs into `docs/references/`.
- Created the bundle: playbooks `security.md`, `code-quality.md`, `code-review.md`, `migrations.md`
  and `quality_score.md`; nine ADRs (`0001`–`0009`); the plans, regressions and references
  sub-bundles with their templates; six references including the OKF specification.
- Wired the Documentation Map contract into new `AGENTS.md` and `CLAUDE.md` files.
- All documented commands were executed before writing: `pnpm typecheck` (green), `pnpm test`
  (96 tests: 69 core, 27 mui), `pnpm build` (four bundles, `"use client"` banner verified present),
  `pnpm test:e2e` (7 scenarios passed).
