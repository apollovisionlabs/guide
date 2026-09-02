---
type: ADR
title: 0005. Keep treeshake disabled to preserve the use client banner
description: tsup treeshaking strips the "use client" banner from the CJS output, so it stays off in both packages.
tags: [adr, build]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0005. Keep treeshake disabled to preserve the use client banner

## Context

Both packages are built on React hooks and context, so a consumer using Next's App Router needs a
`"use client"` directive at the top of the emitted modules. tsup adds it through `banner.js`.

Enabling `treeshake` routes tsup's CJS output through an esbuild-then-rollup pipeline that strips
the banner entirely. This was verified: the directive vanished from both emitted files. The finding
is recorded as a comment in `packages/core/tsup.config.ts` and `packages/mui/tsup.config.ts`.

## Decision

`treeshake: false` in both tsup configs. Both packages instead declare `"sideEffects": false` in
their manifests, which gives consumers dead-code elimination in their own bundler, where it
belongs.

## Consequences

- The published bundles are marginally larger than a tree-shaken build. Given the size of these
  packages, that cost is negligible next to a broken App Router integration.
- Any tsup upgrade must be validated by running `pnpm build` and confirming `"use client";` is
  still the first line of `dist/index.mjs` and `dist/index.cjs` in both packages. This check is
  part of the [migrations playbook](../migrations.md).
- Someone reading the config will be tempted to enable an obvious optimisation; the comment exists
  to stop that, and must be preserved.
