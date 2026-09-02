# Documentation log

Newest first. Add an entry whenever any document in this bundle, or a root guide, changes.

## 2026-09-02

- Renamed the two published packages to `@apollovisionlabs/guide-core` and
  `@apollovisionlabs/guide-mui`. The unclaimed `@guide` scope was abandoned because nothing proved
  it claimable, while the organisation already owns `apollovisionlabs`; the `guide` prefix is kept
  in each name, and the directory names on disk are unchanged. Recorded as
  [ADR 0012](adr/0012-publish-under-the-apollovisionlabs-scope.md). Corrected the statements in
  `CONTRIBUTING.md`, `SECURITY.md` and `INFRA.md` that said the repository has no git remote, and
  reworded the `SECURITY.md` placeholder so it no longer rests on the absent remote. The two
  documents under `docs/superpowers/` keep the old package names.
- Moved the repository from the LogHosp organisation to apollovisionlabs and brought it into line
  with the Apollo Vision Labs conventions. Set the MIT copyright holder to `Apollo Vision Labs` in
  the three `LICENSE` files, pointed both package `repository` fields and `INFRA.md` at
  `github.com/apollovisionlabs/guide.git`, and reworded the `quality_score.md` frontmatter.
  Removed every em dash and en dash from the prose, translated the comments and test names to
  English, and updated the language and commit sections of `CONTRIBUTING.md`. Recorded as
  [ADR 0011](adr/0011-move-to-apollo-vision-labs.md). The two documents under
  `docs/superpowers/` and the existing git history were left untouched on purpose.
- Installed the LogHosp OKF documentation map (OKF v0.2) on branch `docs/okf-doc-map`. Created the
  root guides `ARCHITECTURE.md`, `CONTRIBUTING.md`, `INFRA.md` and `SECURITY.md`; slimmed the three
  `README.md` copies to the public API plus links, moving the licence discipline into
  `CONTRIBUTING.md` and the prior-art URLs into `docs/references/`.
- Created the bundle: playbooks `security.md`, `code-quality.md`, `code-review.md`, `migrations.md`
  and `quality_score.md`; nine ADRs (`0001` to `0009`); the plans, regressions and references
  sub-bundles with their templates; six references including the OKF specification.
- Wired the Documentation Map contract into new `AGENTS.md` and `CLAUDE.md` files.
- Removed the OKF frontmatter from `packages/core/README.md` and `packages/mui/README.md`: both are
  shipped in the npm tarball and rendered as the package front page, which does not strip
  frontmatter. The root `README.md` keeps it. Recorded as
  [ADR 0010](adr/0010-shipped-package-readmes-exempt-from-frontmatter.md); a conformance check must
  treat those two files as exempt.
- All documented commands were executed before writing: `pnpm typecheck` (green), `pnpm test`
  (96 tests: 69 core, 27 mui), `pnpm build` (four bundles, `"use client"` banner verified present),
  `pnpm test:e2e` (7 scenarios passed).
