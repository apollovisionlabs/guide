---
type: ADR
title: 0012. Publish under the apollovisionlabs scope
description: The two published packages moved from the unclaimed @guide scope to @apollovisionlabs, keeping a guide prefix in each name.
tags: [adr, packaging, naming, npm]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T18:20:00Z
  directed_by: human:remy dème
---

# 0012. Publish under the apollovisionlabs scope

## Context

The two packages were named `core` and `mui` under the `@guide` scope. That scope was never
claimed on the registry. `INFRA.md` recorded it as unproven: the publish dry run succeeded, but nothing
established that the `guide` organisation could actually be registered, and the fallbacks noted at
design time were `@guidekit` and `@useguide`.

Meanwhile the repository moved to Apollo Vision Labs ([ADR 0011](0011-move-to-apollo-vision-labs.md)),
and the owner already holds the npm organisation `apollovisionlabs`. Publishing therefore no longer
depended on winning a name, only on using one the owner controls.

## Decision

The published names are `@apollovisionlabs/guide-core` and `@apollovisionlabs/guide-mui`.

The `guide` prefix stays inside each package name. The scope will host other Apollo Vision Labs
projects, so `@apollovisionlabs/core` would say nothing about what the package contains.

The directory names on disk stay `packages/core` and `packages/mui`. Renaming them would move every
file in the repository and bury the rename in the diff, and nothing outside the manifests reads the
directory names.

## Consequences

- Both manifests, the workspace dependency of the MUI package on the core one, the demo's manifest
  and imports, every import in `packages/mui/src` and `packages/mui/test`, the Vitest alias, the
  `paths` mapping in `packages/mui/tsconfig.json`, the `external` list in
  `packages/mui/tsup.config.ts`, the CI workflow, the three READMEs, both `CHANGELOG.md` files and
  the documentation bundle carry the new names.
- `docs/superpowers/specs/2026-09-02-guide-onboarding-design.md` and
  `docs/superpowers/plans/2026-09-02-guide-tour.md` keep the old names. They record what was decided
  at the time, and editing them would falsify the record.
- Package names and directory names now differ. A reader looking for `@apollovisionlabs/guide-mui`
  finds it under `packages/mui`.
- Nothing published under `@guide`, so there is no deprecation to publish and no migration for
  consumers: the packages have never reached a registry.
- Behaviour is unchanged. The rename touches names only.
