---
type: Playbook
title: Migrations playbook
description: How dependency, framework and public-API migrations are handled in a repository with no persistence layer.
tags: [migrations, dependencies, versioning, playbook]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Migrations playbook

## There is no database

This repository has no persistence layer of its own, no schema and no migration directory. Nothing
here creates a table or an index, so the usual index discipline does not apply. What the packages
persist, they persist through the consumer-supplied `GuideStorage` interface, two async methods
writing a tour id, a step index and a status. See [security.md](security.md).

"Migration" in this repository therefore means one of three things: a dependency major, a
supported-peer change, or a public API change.

## Dependency majors

- **Runtime dependencies are avoided.** `@apollovisionlabs/guide-core` has none. `@apollovisionlabs/guide-mui` has exactly one,
  `@apollovisionlabs/guide-core` itself. Everything else is a peer or a dev dependency. Adding a first real runtime
  dependency is an ADR-level decision, and needs a permissive licence
  ([CONTRIBUTING.md](../CONTRIBUTING.md)).
- **Peers express the supported range**, and a range is only advertised once something verifies it.
  `@apollovisionlabs/guide-mui` declares `"@mui/material": "^7 || ^9"`, and the `mui9` job in
  `.github/workflows/ci.yml` installs MUI 9 and typechecks against it. Widening a peer range without
  adding the matching verification is not acceptable. See
  [ADR 0006](adr/0006-support-two-mui-majors.md).
- **React** is peer-pinned to `^19` in both packages. Supporting another major means deciding what
  to do about the hooks the core relies on, and would be an ADR.

## Framework and toolchain moves

Node is pinned to `>=22` and pnpm to `>=10.6.5` in the root `engines`, and the CI workflow uses
Node 22. Raising either means changing both places in the same commit, or continuous integration
and the local contract drift apart.

The build toolchain has one non-obvious constraint: `treeshake` must stay `false` in both tsup
configs, because enabling it strips the `"use client"` banner. Any tsup upgrade must be checked by
running `pnpm build` and confirming the banner is still the first line of all four emitted bundles.
See [ADR 0005](adr/0005-disable-treeshake-to-keep-use-client.md).

## Public API changes

Both packages are published and versioned with [Changesets](references/changesets.md).

- A user-visible change to a published package needs a changeset in the same commit.
- The public surface includes `Spotlight` and `StepPopover` with their prop interfaces, not only
  `GuideTour`. Renaming a prop on either is a breaking change.
- Pre-1.0, a breaking change is a minor bump; say plainly in the changeset what breaks and what
  the replacement is.
- Removing or renaming an exported type from `@apollovisionlabs/guide-core` breaks `@apollovisionlabs/guide-mui` too; both packages
  move together, which is what `updateInternalDependencies: "patch"` handles.

Releases are published by the workflow, with the version bump made in the repository beforehand
rather than by a pull request the workflow opens. See [INFRA.md](../INFRA.md) for the exact
sequence and for the two package managers the publish step relies on.

## Consumer-facing migrations

If a change alters how a consumer declares a tour (the shape of `Step`, the meaning of a policy,
the `data-guide` attribute name), write the migration note in the changeset and update all three
README copies in the same commit.
