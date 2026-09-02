---
type: ADR
title: 0009. Typecheck the MUI package against the core's sources
description: packages/mui maps @guide/core to the core's source files so the repo typechecks before anything is built.
tags: [adr, build]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0009. Typecheck the MUI package against the core's sources

## Context

`@guide/mui` imports `@guide/core`. Resolving that through the published `exports` field means the
core must be built before the MUI package can be typechecked or tested — a build step inside every
edit loop, and a continuous integration ordering constraint on the cheapest jobs.

## Decision

`packages/mui/tsconfig.json` sets `paths` mapping `@guide/core` to `../core/src/index.ts`, and adds
`../core/src/globals.d.ts` to `include` so the core's ambient `process.env` declaration is in
scope. `packages/mui/vitest.config.ts` aliases the same path for the test run.

`pnpm typecheck` and `pnpm test` therefore work on a clean checkout with no build.

## Consequences

Two of these are real limitations and must be understood before trusting a green typecheck:

- **A type error in the core is reported as a `@guide/mui` failure.** The message points at a file
  under `packages/core/src`, but the failing task is the MUI package's. Read the path, not the task
  name.
- **The emitted declaration files are never validated by `pnpm typecheck`.** It checks sources
  against sources; `dist/index.d.ts` and `dist/index.d.cts` are produced by tsup's `dts` step and
  nothing type-checks a consumer against them. A declaration-emit regression would reach a
  registry unnoticed. Nothing in the repository currently closes that gap.
- The alias must be kept in both files. Adding it to only one produces the confusing state where
  tests resolve differently from the compiler.
