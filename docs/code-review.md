---
type: Playbook
title: Code review playbook
description: What a reviewer checks in this repository, in order, and the traps specific to this codebase.
tags: [review, playbook, quality]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Code review playbook

## Order of checks

1. **Verification ran.** `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. In
   continuous integration the build must precede the end-to-end run; the same applies locally,
   because the demo resolves the packages through `dist`.
2. **Security invariants.** Walk [security.md](security.md): no request, no new stored data, no
   hand-built selector, no unreviewed dependency, no forbidden source consulted.
3. **The layering boundary.** Does anything under `packages/core/src` now import MUI, Emotion, or
   a router? That is a rejection, not a discussion.
4. **Architecture conformity.** Does the change fit the mechanisms in
   [ARCHITECTURE.md](../ARCHITECTURE.md) and the decisions in [adr/index.md](adr/index.md)? A
   change that contradicts an ADR needs a new ADR superseding it.
5. **Tests at the right level.** See [code-quality.md](code-quality.md). New public behaviour
   without a test is not reviewable.
6. **Conventions.** Style, comment quality, French commit message in conventional form.
7. **Documentation triggers.** Changeset present for a user-visible change to a published package;
   ADR, plan or regression entry only if a trigger in [AGENTS.md](../AGENTS.md) fired; `log.md`
   updated if any document changed.

## Traps specific to this codebase

- **Step identity.** Any change that reconstructs step objects, or that compares steps by value
  instead of by reference, silently disables the route-timeout path. Check
  `GuideProvider.tsx`'s `routeTimeoutStep` and `navigationRef` if either is touched.
- **Effect cleanup.** Every `MutationObserver`, `setTimeout`, media query and document-level
  listener in this codebase is cleaned up. A missing cleanup usually shows as a test that only
  fails when run with others.
- **Measuring after paint.** `useElementRect` measures in a layout effect on purpose. Moving that
  to `useEffect` makes the spotlight lag one frame behind a step change — a defect no unit test
  currently catches.
- **The public surface is wider than it looks.** `Spotlight` and `StepPopover` are exported with
  their full prop interfaces, so changing either prop object is a breaking change even though
  `GuideTour` is the intended entry point. Say so in the changeset.
- **Both MUI majors.** A change to `packages/mui` that typechecks locally against MUI 7 may fail
  the `mui9` job. Peer ranges and MUI imports deserve a second look.
- **The demo is a test fixture.** Editing `apps/demo` markup or its `data-guide` attributes can
  break `e2e/`.
- **Visual baselines.** A screenshot diff in `e2e/a11y.spec.ts-snapshots/` is not self-evidently a
  regression: the baselines are `darwin`-specific and their pixel content was never independently
  verified. Look at the diff before accepting or re-recording.
- **README parity.** Three copies exist — root, `packages/core`, `packages/mui`. Their prose is
  identical and must stay so. Only the root copy carries OKF frontmatter, because the other two are
  published to npm ([ADR 0010](adr/0010-shipped-package-readmes-exempt-from-frontmatter.md)), so
  compare them below that block.

## Scoring

Significant changes may be scored with [quality_score.md](quality_score.md). Routine fixes are not
scored.
