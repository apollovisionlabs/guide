# Documentation log

Newest first. Add an entry whenever any document in this bundle, or a root guide, changes.

## 2026-09-05

- Fixed a review finding: `INFRA.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `docs/adoption.md` and
  `docs/migrations.md` still described a two package library after `@apollovisionlabs/guide-unstyled`
  landed, and one statement was actively wrong: `INFRA.md` claimed both packages declared
  `"sideEffects": false`, but `@apollovisionlabs/guide-unstyled` declares `["*.css"]` on purpose, so a
  bundler cannot silently drop an adopter's stylesheet import. Updated every package-count and
  build-description sentence these five documents got wrong, and added the reasoning for the
  `sideEffects` difference to `INFRA.md`. `docs/index.md` already said three packages.
- Fixed the other review finding: `.changeset/unstyled-demo-parity.md` would have been the entire
  0.1.0 npm changelog for `@apollovisionlabs/guide-unstyled` and never said what the package is.
  Rewritten to introduce it: a rendering layer for `@apollovisionlabs/guide-core` with no UI
  toolkit, the three surfaces it renders, that appearance is driven by classes and
  `data-guide-part` attributes with an optional stylesheet, and its limits. Corrected the "no
  runtime dependency" claim to "no runtime dependency beyond `@apollovisionlabs/guide-core`",
  since the package does depend on it. Added a second changeset,
  `document-guide-unstyled-in-readmes.md`, marking `@apollovisionlabs/guide-core` and
  `@apollovisionlabs/guide-mui` patch for the README changes already on this branch that no
  changeset covered.
- Added [ADR 0019](adr/0019-a-second-rendering-layer-with-no-toolkit.md): `@apollovisionlabs/guide-unstyled`
  renders the tour, the checklist and the hotspots as plain DOM against the same core, with an
  optional stylesheet rather than a Tailwind build, hand written positioning rather than a
  dependency on one, and parity across all three surfaces rather than a tour only preview. Listed
  it in [adr/index.md](adr/index.md) and updated the package count and the ADR count here.
- `apps/demo` gained a second route, `/unstyled`, rendering `productTour`, `onboardingChecklist`
  and `hotspots` (the exact same declarations the first route renders through
  `@apollovisionlabs/guide-mui`) through `@apollovisionlabs/guide-unstyled` instead, importing its
  stylesheet. `e2e/unstyled.spec.ts` runs the same journeys `tour.spec.ts`, `checklist.spec.ts` and
  `hotspots.spec.ts` already run against it, plus a scenario the styled suite cannot have: a tour
  step near the right edge of a narrow window, asserting the popover's own box stays inside the
  viewport.
- That real browser run caught a genuine defect in `packages/unstyled/src/StepPopover.tsx`: it
  applied the `zIndex` prop it was given directly, tying it with `Spotlight` at the same stacking
  level instead of sitting one above it as the package's own README already documented and as
  `@apollovisionlabs/guide-mui`'s equivalent already did. With the tie, whichever of the two
  happened to mount later in the DOM painted on top, and in practice that was the spotlight,
  silently swallowing clicks on the popover's own buttons. Fixed, and added a changeset marking
  `@apollovisionlabs/guide-unstyled` minor.

## 2026-09-04

- Corrected the checklist restore fix below: `ChecklistProvider`'s restore effect awaited each
  checklist's `storage.read` in sequence and set one shared `restored` flag after the whole loop,
  which meant a hung read for one checklist blocked the loop before it ever reached the next, so
  neither checklist ever restored. Made `restored` a `Record<string, boolean>` on the context,
  one entry per checklist, and read every checklist's storage concurrently rather than in
  sequence, so each checklist settles its own entry as soon as its own read resolves or rejects,
  independently of any other checklist's read. `useChecklist(checklistId).restored` now reads
  that checklist's own entry. Updated the `useChecklist` bullet and the `Checklist` /
  `ChecklistLauncher` paragraph in all three READMEs, and the changeset, to say "per checklist"
  rather than "for the whole provider". Still no new ADR, for the same reason as before.
- Fixed the same restore-race defect in the checklist that `useHotspots` was fixed for
  (`packages/core/src/ChecklistProvider.tsx`, `packages/core/src/useChecklist.ts`): a checklist
  rendered its initial empty state, nothing completed and not dismissed, until its async storage
  read landed. `useChecklist` gains `restored`, true immediately with no `storage` prop and true
  once every checklist's read has resolved or rejected; `Checklist` and `ChecklistLauncher`
  (`@apollovisionlabs/guide-mui`) both wait for it before drawing anything. Documented in the
  `useChecklist` bullet and a new paragraph in the `Checklist` and `ChecklistLauncher` section, in
  all three READMEs. Added a changeset marking both packages minor. No new ADR: the general rule
  (settle immediately with no storage, settle on reject as well as resolve, a renderer waits for
  it) was established as a bug fix for hotspots, not recorded as an architectural decision there,
  so recording it here as one would be inventing a precedent that does not exist.
- Corrected [ADR 0018](adr/0018-hotspots-defer-to-a-running-tour.md) where it claimed the
  temporary `tabindex` is always removed on blur. It is now kept only once focus is verified to
  have landed, so the claim holds; the ADR also states what it had omitted, that focus can end up
  nowhere when the step's target cannot take it, that `focus()` carries an implicit scroll, and
  that suppressing markers on `paused` can outlive any visible tour.
- Said in all three READMEs that a tour paused on a target that never appears hides every hotspot
  for as long as it stays paused, and pointed at the `skip` and `error` policies as the way out.
- Corrected the `advanceOn` target-replacement paragraph in `README.md`, both package READMEs and
  [adoption.md](adoption.md). The inference it stated was right, the framing around it was wrong
  twice: it sent the reader to the missing-target policy, but the target was found once so the
  timeout was already cleared, no `target:missing` is emitted and no `wait`, `skip` or `error`
  policy runs; and it called the consequence unspecific to `advanceOn`, when such a step has no
  primary button and ignores `ArrowRight`, so a replaced node leaves `Escape` as the only exit.
- Documented what `Hotspots` now does at the seam with a running tour: no marker while a tour is
  running or paused, a marker only for a target with actual size on screen, and no second
  `hotspot:open` for a bubble already open. Added the last of those to the events table.
- Made the Hotspots snippet in all three READMEs copyable: it named `tourId: 'welcome'` while
  passing an undefined `tour` to `GuideProvider` and rendering an undefined `Sidebar`. The tour it
  names is now defined in the snippet.
- Recorded [ADR 0018](adr/0018-hotspots-defer-to-a-running-tour.md) and added it to
  [adr/index.md](adr/index.md) and to the Decisions section of [index.md](index.md).
- Extended the changeset with the one source-level note on this branch: `StepPopoverLabels` gained
  a required `awaitingAction`, so an annotated full labels constant stops typechecking. Both
  packages stay a minor.
- Documented advancing a step on a click and hotspots, both merged past what
  `docs/superpowers/plans/2026-09-04-guide-actions-and-hotspots.md` described: `useHotspots()`
  returns six members, not five (`restored` was added during implementation), and `Hotspots` takes
  `labels`, `placement` and `zIndex`. Added an "Advancing on an action" section and a "Hotspots"
  section to `README.md`, copied verbatim into both package READMEs; added `advanceOn` to the
  `GuideTour` `labels` row, `hotspot:show` / `hotspot:open` to the events table, `hotspots:seen` to
  the persistence section, and `isHotspotsProgress` to the validation sentence.
- Extended step 8 of [adoption.md](adoption.md) with `advanceOn: 'click'`, and added step 11,
  "Add hotspots (optional)". Stated the one stacking limit plainly: a hotspot whose target lives
  inside a modal dialog is covered by it, because the default marker `zIndex` sits below
  `theme.zIndex.modal`; `zIndex` on `Hotspots` is the way out. Added `e2e/hotspots.spec.ts` and the
  click-step scenario in `e2e/tour.spec.ts` to the "Verify" step, and the two `hotspot:*` events to
  "What this library does not do".
- Recorded [ADR 0017](adr/0017-advancing-on-an-action-implies-an-interactive-step.md): a step
  declaring `advanceOn` gets `interactive` and `awaitsAction` derived on `ActiveStep`
  (`packages/core/src/GuideProvider.tsx`), rather than requiring the caller to also set
  `interactive: true`. A renderer must read `ActiveStep`, not `Step.interactive` directly.
- Added the ADR to [adr/index.md](adr/index.md) and to the Decisions section of [index.md](index.md),
  and listed the new spec and plan in [index.md](index.md)'s "Outside this bundle" section.
- Added a changeset marking both packages minor. Nothing on this branch is breaking.

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
