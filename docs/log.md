# Documentation log

Newest first. Add an entry whenever any document in this bundle, or a root guide, changes.

## 2026-09-03

- Documented the first-steps checklist: `ChecklistProvider`, `useChecklist`, and the MUI
  `Checklist` and `ChecklistLauncher` components. Added a Checklist section and three new
  `checklist:*` events to `README.md`, copied verbatim into both package READMEs; added an
  integration step and a trap to [adoption.md](adoption.md) (a checklist item whose `tourId`
  names no tour on the `GuideProvider` fails as an unhandled promise rejection, not a warning);
  removed the "no onboarding checklist" line from "What this library does not do", now false.
- Recorded [ADR 0016](adr/0016-one-storage-contract-for-tours-and-checklists.md): `GuideStorage`
  became generic over the stored value and the key, so `GuideProvider` and `ChecklistProvider`
  share one storage instance under `tour:<id>` and `checklist:<id>`. Corrected the stale
  `read(tourId)` / `write(tourId, progress)` signature this replaced everywhere it was documented,
  in `README.md` and in `adoption.md`'s persistence step. Two breaking consequences follow: a
  custom `GuideStorage` implementation must widen its signature, and tour progress stored under
  the old bare-id key is orphaned, so a user mid tour restarts it once.
- Added the new spec, plan and this ADR to the "Outside this bundle" and Decisions sections of
  [index.md](index.md) and to [adr/index.md](adr/index.md).
- Added a changeset marking both packages minor for the checklist feature and the two breaking
  consequences above.

## 2026-09-02

- Corrected `docs/migrations.md`, which still said nothing had been released and no release
  workflow existed. Both statements were contradicted by `INFRA.md` and by `0.1.1` shipping
  from the workflow.
- Added [adoption.md](adoption.md), the integration playbook: the ordered sequence from installing
  the two packages to a multi-page tour, then the choices that follow (missing-target policy,
  persistence and why browser storage is wrong on a shared workstation, text and labels,
  interactive steps and the non-modal consequence, what to verify). Closes with the three traps a
  first integration hits and with what the library does not do. It links to the API reference in
  `README.md` rather than restating it, and is listed in [index.md](index.md).
- Released `0.1.1` through the workflow, which is the first version published without a human
  touching the registry. Both packages carry a signed provenance attestation, verified on the
  registry rather than taken from the publish output. `INFRA.md` now states provenance as
  observed instead of expected.
- Replaced the `changesets/action` publish step with `pnpm pack` followed by `npm publish`,
  after two failed release runs established that pnpm 10 does not perform the OIDC exchange
  and that `actions/setup-node` writes a placeholder auth line which prevents it. Recorded as
  [ADR 0015](adr/0015-pack-with-pnpm-publish-with-npm.md), which refines
  [ADR 0014](adr/0014-authenticate-releases-with-trusted-publishing.md) and removes the step
  [ADR 0013](adr/0013-publish-from-a-release-workflow.md) introduced.
- Recorded that versioning runs locally rather than through a pull request opened by
  `changesets/action`: the organisation does not allow GitHub Actions to create pull requests.
  Corrected the release workflow description in `INFRA.md` accordingly.
- Published `@apollovisionlabs/guide-core@0.1.0` and `@apollovisionlabs/guide-mui@0.1.0` by hand,
  the bootstrap that trusted publishing cannot do. Corrected `INFRA.md` and `SECURITY.md`,
  which said the packages had never reached a registry, and recorded what was verified against
  it: both module formats resolve, the declarations typecheck under `strict`, the workspace
  dependency was rewritten to `0.1.0`, and there is no provenance attestation on this version.
- Replaced the release workflow's stored `NPM_TOKEN` with npm trusted publishing, after npm
  advised against long lived tokens for continuous integration. Recorded as
  [ADR 0014](adr/0014-authenticate-releases-with-trusted-publishing.md), which supersedes the
  authentication part of [ADR 0013](adr/0013-publish-from-a-release-workflow.md). Rewrote the
  release path section of `INFRA.md`: the gate is now the `RELEASE_ENABLED` repository
  variable, the first publish of each package has to be manual because npm cannot attach a
  trusted publisher to a package that does not exist, and provenance is expected but not yet
  observed.
- Added the release workflow, `.github/workflows/release.yml`. A push to `main` runs the full
  verification then hands over to `changesets/action`, which opens a version pull request when
  changesets are pending and publishes what the registry lacks when none are. Recorded as
  [ADR 0013](adr/0013-publish-from-a-release-workflow.md). Rewrote the release path section of
  `INFRA.md`, which said no release workflow existed, and noted that the `NPM_TOKEN` secret is
  the gate on the first publish and that provenance is not enabled.
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
