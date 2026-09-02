---
type: ADR
title: 0011. Move to the Apollo Vision Labs organisation
description: The repository moved from LogHosp to apollovisionlabs, and the Apollo conventions now govern its prose, naming and language.
tags: [adr, convention, ownership]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T17:45:00Z
  directed_by: human:remy dème
---

# 0011. Move to the Apollo Vision Labs organisation

## Context

The repository was created under the LogHosp GitHub organisation and written under the LogHosp
conventions. It has been transferred to the apollovisionlabs organisation. The Apollo Vision Labs
house conventions differ from the previous ones on two points that touch almost every file:
prose carries no em dash and no en dash, and code, comments, commit messages and documentation are
written in English.

## Decision

The Apollo Vision Labs conventions govern the prose, naming and language of this repository from
now on. Ownership metadata names Apollo Vision Labs.

## Consequences

Acted on:

- The MIT copyright holder in the three `LICENSE` files is `Apollo Vision Labs`. The year and the
  licence text are unchanged.
- The `repository` field of `packages/core/package.json` and `packages/mui/package.json`, and the
  URL quoted in `INFRA.md`, point at `github.com/apollovisionlabs/guide.git`.
- Every em dash and en dash was removed from the prose, by restructuring the sentence rather than
  by substituting a hyphen.
- Every French comment, test name and test fixture string in `packages/`, `apps/` and `e2e/` was
  translated to English. The reasons those comments record were preserved, not summarised.
- The language and commit sections of `CONTRIBUTING.md` state the English rule.

Deliberately not acted on:

- The existing git history keeps its French commit subjects. Rewriting 41 commits would be a
  destructive history rewrite, and it would gain nothing: the messages describe work already
  merged, and every reader of the history is reading it alongside the code it produced.
- `docs/superpowers/specs/2026-09-02-guide-onboarding-design.md` and
  `docs/superpowers/plans/2026-09-02-guide-tour.md` are untouched, French prose and dashes
  included. They record the decisions taken at the time, one of which was to publish under the
  LogHosp organisation. Editing them would falsify the record.
- The documentation bundle keeps its OKF structure, which came from a LogHosp convention. The
  structure is sound and independent of who owns the repository, so there is nothing to gain from
  changing it. Statements of provenance that remain true, such as `docs/references/okf-spec.md`
  recording where the `directed_by` extension came from, are kept as facts.
