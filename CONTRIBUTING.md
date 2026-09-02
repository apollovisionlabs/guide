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
| `pnpm test` | Vitest, jsdom environment: 69 tests in `@apollovisionlabs/guide-core`, 27 in `@apollovisionlabs/guide-mui`. |
| `pnpm build` | tsup in both packages: ESM, CJS, declarations, sourcemaps. |
| `pnpm test:e2e` | Playwright, Chromium only: 7 scenarios in `e2e/`. |
| `pnpm --filter demo dev` | The demo app on `http://localhost:5173`. |

`pnpm test:e2e` starts the demo itself through Playwright's `webServer`
(`playwright.config.ts`), reusing an already-running server outside CI. **Run `pnpm build`
first**: the demo resolves `@apollovisionlabs/guide-core` and `@apollovisionlabs/guide-mui` through their `dist` output, so an
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

The repository has a git remote. It lives at `https://github.com/apollovisionlabs/guide`, and
`origin` still uses `github.com/LogHosp/guide`, the path it had before the transfer, which GitHub
redirects. No pull request process is documented yet: this section needs updating once one is
agreed.

## Commits

Conventional commits, **written in English**. Lowercase type, an imperative subject, no trailing
period and no dash:

```
feat(core): context provider, useTour and useGuideStep
fix(mui): keyboard escape hatch, container focus and clickable hole
test(core): drop the act warning from the skip policy test
docs: remove the reference to a missing screenshot
chore: public access, demo scroll margin and asserted announcement
```

Commits made before the move to the apollovisionlabs organisation are in French. That history is
left as it is ([ADR 0011](docs/adr/0011-move-to-apollo-vision-labs.md)).

Scopes in use: `core`, `mui`, `demo`. `docs`, `test` and `chore` are used unscoped as well.

## Language policy

Code, comments, test names, commit messages and documentation are written in English. That covers
the READMEs, the demo's page copy, the popover's default button labels, the public type
documentation, source comments and `describe` and `it` titles.

Two exceptions, both deliberate:

- the documents under `docs/superpowers/`, which are the historical design and plan and stay in
  French because they record what was decided at the time;
- the git history, whose commit subjects are French up to the move to the apollovisionlabs
  organisation.

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
