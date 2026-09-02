---
type: ADR
title: 0013. Publish from a release workflow driven by Changesets
description: A push to main runs the full verification then hands over to changesets/action, which either opens a version pull request or publishes what the registry does not have.
tags: [adr, ci, release, packaging, npm]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T16:03:42Z
  directed_by: human:remy dème
---

# 0013. Publish from a release workflow driven by Changesets

## Status

Stable.

## Context

Changesets was configured from the start, and both packages carry the manifest fields a publish
needs. What was missing was the path that actually runs it. `changeset version` and
`changeset publish` had never run against a registry, and `.github/workflows/` held only `ci.yml`,
so every release would have been a manual act on someone's laptop, unrecorded and unrepeatable.

Two properties matter more than convenience here. A published version must correspond to a commit
that passed the full verification, including the end to end suite, which is the only evidence that
a tour works in a browser. And two releases must never run at once, because they would race on the
version commit and on the registry.

## Decision

`.github/workflows/release.yml` runs on a push to `main`, in a `concurrency` group of one.

It reinstalls from the lockfile, then runs `pnpm typecheck`, `pnpm test`, `pnpm build`, and the
Playwright suite, in that order. The build precedes the end to end run because the demo resolves
the packages through `dist`. It then hands over to `changesets/action`, configured with
`pnpm changeset version` and `pnpm changeset publish`.

That action has two behaviours and picks between them on its own. When changesets are pending it
opens or updates a pull request titled `chore: version packages` and publishes nothing. When none
are pending it publishes every package whose version is not yet on the registry.

The workflow repeats the checks that `ci.yml` already runs rather than depending on it. Two
workflows triggered by the same push do not order themselves, so a release that trusted a sibling
workflow could publish while that sibling was still running or already red.

Authentication comes from a repository secret, `NPM_TOKEN`, an npm automation token with publish
rights on the `@apollovisionlabs` scope. `actions/setup-node` is given `registry-url` so it writes
the `.npmrc` that pnpm reads.

## Consequences

The secret is the gate on the first release. Until `NPM_TOKEN` exists the publish step fails and
nothing reaches the registry. Once it exists, the next push to `main` publishes `0.1.0` for both
packages, because neither version is on the registry and no changesets are pending. That is
intended, and it is stated in `INFRA.md` so it cannot come as a surprise.

A contributor who changes a published package's behaviour must add a changeset in the same commit.
Without one the change reaches `main` and is published under the current version number, or is not
published at all if that version already exists.

Publish provenance is not enabled. pnpm 10.20.0 exposes no provenance option on `pnpm publish`, so
enabling it would mean calling `npm publish` inside the release step instead, and verifying that
the attestation is actually produced. Neither has been done, and claiming provenance without
verifying it would be worse than not having it.

## Alternatives considered

**Publishing on a tag.** Tags decouple the published version from the changelog that Changesets
maintains, and they invite a human to pick the version by hand, which is the mistake Changesets
exists to prevent.

**Reusing the `ci` workflow through `workflow_run`.** It removes the duplicated checks, at the cost
of a release that depends on the outcome of a run it cannot see the code of, and of a second
trigger path to reason about. The duplication costs about a minute of runner time and buys a
release job that is true on its own.

**A manual `workflow_dispatch` trigger.** It would prevent an unattended first publish, but the
secret already provides that gate, and a manual trigger makes every later release depend on someone
remembering to press a button.
