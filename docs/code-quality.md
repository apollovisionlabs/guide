---
type: Playbook
title: Code quality playbook
description: The conventions this codebase actually follows, and the test expectations a change must meet.
tags: [quality, conventions, typescript, testing]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Code quality playbook

No linter and no formatter are configured. Every rule below is enforced by review, and every one
of them is observed in the current sources — none is aspirational.

## TypeScript

`tsconfig.base.json` is shared by all packages and is strict in ways that change how code is
written:

- `strict` and **`noUncheckedIndexedAccess`**: `array[i]` is `T | undefined`. The codebase either
  narrows it (`if (!candidate) return`) or asserts with `!` where the bound has just been checked,
  as in the focus trap's `elements[0]!`. Do not relax the option to avoid the noise.
- **`verbatimModuleSyntax`**: type-only imports must be written `import type { … }`, or inline as
  `import { useId, type MouseEvent } from 'react'`. A value import of a type is a compile error.
- `isolatedModules`, `moduleResolution: bundler`, `noEmit`. Emission is tsup's job, not tsc's.

## Style

Observed uniformly across `packages/` and `apps/`:

- No semicolons. Single quotes. Two-space indent. Lines wrap around 100 characters.
- Named exports only; there is no `export default` anywhere in `packages/`.
- One concern per file, named after its export (`useElementRect.ts`, `matchRoute.ts`,
  `Spotlight.tsx`).
- Hooks and components that touch React context or browser APIs carry the `'use client'` pragma at
  the top of the file (`GuideProvider.tsx`, `useTour.ts`, `useGuideStep.ts`, and all three MUI
  components).
- Errors thrown to consumers are prefixed `[guide] `, and so are `console.warn` messages.

## Comments

The bar here is high and worth matching: comments in this codebase explain **why**, and almost
always cite the failure they prevent. Examples to imitate rather than paraphrase:

- `useElementRect.ts` explains that a `useEffect` would let one frame through with the spotlight
  still on the previous target.
- `useTargetElement.ts` explains why the observer is not disconnected on timeout.
- `tsup.config.ts` explains, with the verification result, why `treeshake` is off.

A comment that restates the code is worse than none. A comment that records a rejected alternative
is the most valuable kind.

Comments and test names are written in **French**; everything a stranger reads is in English. See
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Tests

- Unit tests live in `packages/<pkg>/test/`, named after the unit under test, run by Vitest with
  the jsdom environment. Current counts: 69 in `@guide/core`, 27 in `@guide/mui`.
- End-to-end scenarios live in `e2e/` and run under Playwright against `apps/demo`. Current count:
  7.
- A new behaviour needs a test at the lowest level that can express it: pure logic in
  `tourMachine.test.ts` or `matchRoute.test.ts`, DOM behaviour in a hook test, cross-page or
  keyboard behaviour end to end.
- Tests assert what is guaranteed and no more — `useElementRect.test.tsx` deliberately bounds its
  claims about the rectangle rather than pinning jsdom's arbitrary zeros.
- Do not fix an `act` warning by silencing it; the existing tests fix the cause.

## Rendering discipline

- Nothing in `packages/core` may import MUI, Emotion, or a router. That boundary is the product.
- Values handed to consumers through context are memoised (`useMemo`) and callbacks are stable
  (`useCallback`), because they are dependencies of consumer effects.
- Identity matters: the provider compares step objects by reference, so anything that rebuilds a
  step on every render is a bug. See [ARCHITECTURE.md](../ARCHITECTURE.md).

## Definition of done

`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` all green, plus a changeset when a
published package's behaviour changed. A quality score, when one is requested, follows
[quality_score.md](quality_score.md).
