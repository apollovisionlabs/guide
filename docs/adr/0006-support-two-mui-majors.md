---
type: ADR
title: 0006. Support two MUI majors and verify the second in CI
description: The MUI rendering package advertises MUI 7 or 9, and a dedicated CI job installs MUI 9 and typechecks against it.
tags: [adr, build]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0006. Support two MUI majors and verify the second in CI

## Context

Applications do not upgrade their design system on the library's schedule. A tour package that
supports only one MUI major forces the consumer to choose between the tour and their upgrade
timeline. But an advertised peer range that nothing exercises is a guess.

## Decision

`packages/mui/package.json` declares `"@mui/material": "^7 || ^9"`. MUI 7 is the dev dependency,
so it is what the unit tests and the demo exercise. A second continuous integration job, `mui9` in
`.github/workflows/ci.yml`, installs `@mui/material@9` into the package and runs its typecheck.

The rule that follows: **a peer range is only widened together with something that verifies the
new bound.**

## Consequences

- The compatibility table in the README is a verified claim, not a hope.
- The verification is a typecheck, not a test run, so it catches API and type breakage but not
  runtime or visual differences between the two majors. That limit is accepted and stated.
- The `mui9` job is independent of `verify`, so a MUI 9 break is visible without blocking the rest
  of the signal.
- Keeping the MUI surface small (`Box`, `Button`, `IconButton`, `Paper`, `Popper`, `Typography`,
  `alpha`, `useTheme`) is what makes spanning two majors realistic. Reaching for a component that
  differs between them reopens this decision.
