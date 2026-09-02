---
type: Guide
title: Contributing
description: Prerequisites, local commands, branch and commit conventions, and the licence discipline every contributor must follow.
tags: [contributing, workflow, conventions, licensing]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Contributing

## Prerequisites

`package.json` pins them: **Node >= 22** and **pnpm >= 10.6.5** (the repo declares
`packageManager: pnpm@10.20.0`). Install once with `pnpm install`.

## Commands

Run from the repository root. All four are verified to pass on the current tree.

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` in `packages/core` and `packages/mui`. |
| `pnpm test` | Vitest, jsdom environment: 69 tests in `@guide/core`, 27 in `@guide/mui`. |
| `pnpm build` | tsup in both packages: ESM, CJS, declarations, sourcemaps. |
| `pnpm test:e2e` | Playwright, Chromium only: 7 scenarios in `e2e/`. |
| `pnpm --filter demo dev` | The demo app on `http://localhost:5173`. |

`pnpm test:e2e` starts the demo itself through Playwright's `webServer`
(`playwright.config.ts`), reusing an already-running server outside CI. **Run `pnpm build`
first**: the demo resolves `@guide/core` and `@guide/mui` through their `dist` output, so an
end-to-end run against a stale or absent build tests the wrong code. The CI workflow orders the
steps for exactly that reason. See [INFRA.md](INFRA.md).

Two gaps in local coverage, stated as facts:

- `apps/demo` declares no `typecheck` script, so `pnpm typecheck` never checks the demo's
  TypeScript. Only its Vite build would.
- No linter or formatter is configured. Style is enforced by review against
  [docs/code-quality.md](docs/code-quality.md), not by a tool.

## Branches

Branch off `main`. Observed names are `<kind>/<slug>`, kebab-case: `feat/tour-v1`,
`docs/okf-doc-map`.

The repository currently has **no git remote**. Branches and commits stay local, and there is no
pull request flow to follow yet; when a remote is added this section needs updating.

## Commits

Conventional commits, **written in French**, as `git log` shows without exception:

```
feat(core): fournisseur de contexte, useTour et useGuideStep
fix(mui): échappatoire clavier, focus sur le conteneur et trou cliquable
test(core): supprimer l'avertissement act du test de politique skip
docs: retirer la référence à une capture inexistante
chore: accès public, marge de défilement de la démo et annonce assertée
```

Scopes in use: `core`, `mui`, `demo`. `docs`, `test` and `chore` are used unscoped as well.

## Language policy

The repository is bilingual on purpose, and inconsistently so. This is the current state, not a
target:

- **English**: everything a stranger reads, namely the READMEs, the demo's page copy, the popover's
  default button labels, the public type documentation.
- **French**: source comments and test names (`test('le tour traverse trois pages et se termine')`).

Match the file you are editing rather than converting it.

## Licence discipline, not optional

This package is MIT and must stay MIT-clean.

- **Never read, open, or consult the source of Intro.js or Shepherd.js.** They are dual-licensed
  AGPL or commercial, and reading them creates a contamination risk for an MIT codebase. This is a
  hard rule, applied at the design stage
  (`docs/superpowers/specs/2026-09-02-guide-onboarding-design.md`, §2) and it applies to humans and
  to agents alike.
- Prior art that **may** be read and attributed is MIT: [driver.js](docs/references/driver-js.md),
  [react-joyride](docs/references/react-joyride.md), [reactour](docs/references/reactour.md).
- A new runtime dependency needs a permissive licence and a justification; see
  [docs/migrations.md](docs/migrations.md).

## Changesets

Version bumps and changelogs go through [Changesets](docs/references/changesets.md)
(`.changeset/config.json`, `baseBranch: main`, `access: public`). Add a changeset in the same
commit as a user-visible change to a published package. Release mechanics, and what has and has
not actually been exercised, are in [INFRA.md](INFRA.md).

## Before you commit

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm build`
4. `pnpm test:e2e`

Then follow the documentation contract in [AGENTS.md](AGENTS.md): update
[docs/log.md](docs/log.md) whenever a document changes, and add an ADR, a plan or a regression
entry only on the triggers listed there.
