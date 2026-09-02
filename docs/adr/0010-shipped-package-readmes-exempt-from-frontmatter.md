---
type: ADR
title: 0010. Exempt the shipped package READMEs from the OKF frontmatter rule
description: The two per-package README copies are published to npm, so they carry no OKF frontmatter; the root README carries it.
tags: [adr, documentation, packaging]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0010. Exempt the shipped package READMEs from the OKF frontmatter rule

## Context

The LogHosp OKF convention requires YAML frontmatter — `type`, `title`, `description`, `tags`,
`status`, `generated` — on every non-reserved markdown file in the repository. Applying it
literally puts that block at the top of all three `README.md` copies: the root one, and one in
each package.

The two package copies are not only documentation. Both manifests list `README.md` in `files`
(`packages/core/package.json`, `packages/mui/package.json`), so each copy is shipped inside the
npm tarball and rendered by the registry as the package's front page. npm does not strip YAML
frontmatter: it displays it. A raw metadata block would be the first thing a stranger evaluating
the library sees.

## Decision

The root `README.md` carries the OKF frontmatter. `packages/core/README.md` and
`packages/mui/README.md` carry **none**. Their prose stays byte-identical to the root copy's prose,
as it already must.

The convention exists to make documentation machine-readable inside the repository, not to degrade
a published product surface. Where those two purposes conflict, and only there, the published
surface wins.

## Consequences

- A conformance check over this repository must treat `packages/core/README.md` and
  `packages/mui/README.md` as **exempt**, in the same way it already skips the reserved
  `index.md` / `log.md` files, the generated `CHANGELOG.md` files, and the pre-existing documents
  under `docs/superpowers/`. An exemption that is not encoded in the checker will be reported as
  two failures.
- The exemption is narrow and must stay so: it covers files that are published to a registry, not
  files that are merely long or merely user-facing. Any other markdown file added to a package's
  `files` array inherits it; nothing else does.
- Whoever keeps the three copies in sync must remember that they are identical **below** the
  frontmatter, not from the first line. A naive `diff` reports the block as a difference.

## Alternative rejected

Deleting `packages/core/README.md` and `packages/mui/README.md` and keeping only the root one.
That would satisfy the rule with no exemption, but both npm package pages would then be empty —
npm renders nothing when a package ships no README — which is a far worse outcome for a library
whose whole point is to be adopted by strangers.
