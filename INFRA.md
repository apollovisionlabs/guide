---
type: Guide
title: Infrastructure
description: How this monorepo builds, what continuous integration runs and in which order, and the exact state of the release path.
tags: [infra, ci, build, release, packaging]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Infrastructure

There is no deployed service here: this repository produces two npm packages and a private demo
application. "Infrastructure" means the build, continuous integration, and the release path.

## Workspace

pnpm workspaces (`pnpm-workspace.yaml`: `packages/*`, `apps/*`). The root `package.json` is
private and only holds scripts and shared dev dependencies: React, Vitest, Testing Library, jsdom,
tsup, TypeScript, Playwright and the Changesets CLI are all hoisted there. Each package keeps only
what is genuinely its own (`@mui/material` and Emotion as dev dependencies of `@apollovisionlabs/guide-mui`, to
satisfy its own peers during tests).

`tsconfig.base.json` is the shared compiler configuration: `strict`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, `moduleResolution: bundler`,
`noEmit`, target ES2020.

## Build

Both packages build with tsup (`packages/*/tsup.config.ts`), from a single entry `src/index.ts`:

- **Formats**: ESM (`dist/index.mjs`) and CJS (`dist/index.cjs`), with `.d.ts` and `.d.cts`
  declarations and sourcemaps. `package.json` exposes them through `exports`, `main`, `module` and
  `types`.
- **Banner**: `"use client";` is prepended to every output file, which Next's App Router requires
  for a package built on hooks. Verified present at the top of all four emitted bundles.
- **`treeshake: false`, deliberately.** Enabling it routes tsup's CJS output through an
  esbuild-then-rollup pipeline that strips the banner entirely. The configs carry that reason as a
  comment, and it is recorded in
  [ADR 0005](docs/adr/0005-disable-treeshake-to-keep-use-client.md). Consumers are not penalised:
  both packages declare `"sideEffects": false`, so a consumer's own bundler still eliminates dead
  code.
- **Externals**: React and ReactDOM for the core; those plus `@apollovisionlabs/guide-core`, `@mui/material` and
  both Emotion packages for the MUI layer. Nothing peer-declared is inlined.

## Typecheck wiring

`packages/mui/tsconfig.json` maps `@apollovisionlabs/guide-core` to `../core/src/index.ts` and includes
`../core/src/globals.d.ts`, and `packages/mui/vitest.config.ts` aliases the same path. The repo
therefore typechecks and tests from sources, with no build step required first. Two consequences,
documented in [ADR 0009](docs/adr/0009-typecheck-core-through-sources.md): a type error introduced
in the core is reported as a `@apollovisionlabs/guide-mui` failure, and the **emitted declaration files are never
validated** by `pnpm typecheck`.

## Continuous integration

`.github/workflows/ci.yml`, triggered on `push` and `pull_request`. Two independent jobs, both on
`ubuntu-latest` with Node 22 and pnpm cache.

### `verify`

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

**The order is load-bearing.** `apps/demo` imports `@apollovisionlabs/guide-core` and `@apollovisionlabs/guide-mui` as workspace
dependencies resolved through their `dist` output, and `pnpm test:e2e` boots that demo. Moving
`pnpm build` after the end-to-end step would run Playwright against a missing or stale bundle.
On failure the `playwright-report` directory is uploaded as an artifact.

### `mui9`

Installs `@mui/material@9` into `@apollovisionlabs/guide-mui` and runs only that package's typecheck. This is what
makes the advertised `"@mui/material": "^7 || ^9"` peer range an actually verified claim rather
than an aspiration: MUI 7 is exercised by the unit tests and the demo, MUI 9 by this job.

## Tests

- **Unit**: Vitest with the jsdom environment and `globals: true`, one config per package, each
  with its own `test/setup.ts`. 69 tests in `@apollovisionlabs/guide-core`, 27 in `@apollovisionlabs/guide-mui`.
- **End-to-end**: Playwright (`playwright.config.ts`), a single `chromium` project against
  `http://localhost:5173`, `trace: 'on-first-retry'`. 7 scenarios: four in `e2e/tour.spec.ts`
  (cross-page traversal, resume after interruption, spotlight tracking on scroll, interactive
  step), three in `e2e/a11y.spec.ts` (full keyboard path, live-region announcements, both themes).
- **Visual baselines**: `e2e/a11y.spec.ts-snapshots/tour-light-chromium-darwin.png` and
  `tour-dark-chromium-darwin.png`. They are platform-specific (`darwin`) and their pixel content
  has never been independently verified. They pin whatever was rendered when they were recorded.
  Treat a mismatch as a signal to look at the diff, not as proof of a regression.

## Release path, exact state

Everything below is what *exists*, not what is planned.

- **Configured**: Changesets (`.changeset/config.json`), `access: public` and
  `publishConfig.access: "public"` on both packages, `files: ["dist", "README.md", "LICENSE"]`,
  a `repository` field pointing at `https://github.com/apollovisionlabs/guide.git`, and a `0.1.0` entry in
  each `CHANGELOG.md`.
- **A release workflow exists**: `.github/workflows/release.yml`, triggered by a push to `main`.
  It reinstalls, typechecks, tests, builds and runs the end to end suite, then hands over to
  `changesets/action`. With pending changesets that action opens or updates a version pull request
  and publishes nothing. With none, it publishes every package whose version is not yet on the
  registry. A `concurrency` group keeps two releases from racing on the version commit.
- **Authentication is npm trusted publishing, not a stored token.** The job asks for
  `id-token: write`, GitHub mints an OIDC token, and npm exchanges it for a short lived
  credential. No long lived npm token exists in the repository secrets.
- **The release step is gated on a repository variable**, `RELEASE_ENABLED`. While it is anything
  other than `true` the step is skipped, the run logs a warning and stays green, and nothing
  reaches the registry. The gate exists because trusted publishing must be configured per package
  on npmjs.com, and a package cannot be configured before it exists.
- **The first publish of each package cannot use trusted publishing.** npm requires the package to
  exist before a trusted publisher can be attached to it, so `0.1.0` has to be published once by
  another route, from a maintainer's machine with their own account. Bootstrapping is a manual,
  one time act; every later release goes through the workflow.
- **A git remote exists.** `origin` points at `https://github.com/apollovisionlabs/guide`, which
  is also the `repository` URL in both manifests.
- **Never executed for real**: publishing has only ever been exercised as a dry run.
  `changeset version` and `changeset publish` have never run against a registry, so the first
  successful workflow run will publish `0.1.0` for both packages.
- **Provenance is expected but unverified.** Trusted publishing normally attaches a provenance
  attestation, and pnpm 10.20.0 exposes no provenance option of its own. Whether an attestation is
  actually produced through `pnpm changeset publish` must be checked on the npm page of the first
  package published this way, and this document corrected to say what was observed.
- **The pnpm major matters.** OIDC publishing is reported working in pnpm 10, which is the version
  pinned here, and broken in pnpm 11.0.8. Treat a pnpm major upgrade as a change that has to be
  revalidated against the registry, not as routine maintenance.
- **The packages sit in the `@apollovisionlabs` scope**, which the organisation already owns:
  `@apollovisionlabs/guide-core` and `@apollovisionlabs/guide-mui`. The unclaimed `@guide` scope
  and its fallbacks were abandoned, see
  [ADR 0012](docs/adr/0012-publish-under-the-apollovisionlabs-scope.md).

## Demo application

`apps/demo` is a Vite 7 + React 19 + React Router 7 single-page app served on port 5173
(`vite --port 5173`). It is private, never published, and doubles as the Playwright fixture, so a
change to its markup or its `data-guide` attributes can break the end-to-end suite.
