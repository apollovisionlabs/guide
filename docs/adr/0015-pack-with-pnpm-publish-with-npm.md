---
type: ADR
title: 0015. Pack with pnpm, publish with npm
description: pnpm rewrites the workspace protocol but cannot do the OIDC exchange, npm can do the exchange but not the rewrite, so the release step uses each for what it does.
tags: [adr, ci, release, npm, pnpm, oidc]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T16:03:42Z
  directed_by: human:remy dème
---

# 0015. Pack with pnpm, publish with npm

## Status

Stable. Refines [ADR 0014](0014-authenticate-releases-with-trusted-publishing.md), which chose
trusted publishing and named this fallback without knowing it would be needed. It also removes the
`changesets/action` step that [ADR 0013](0013-publish-from-a-release-workflow.md) introduced.

## Context

The first release published by the workflow was `0.1.1`, a version whose only purpose was to prove
the path before a release that mattered depended on it. It failed twice, and each failure taught
something the documentation had been recording as unverified.

The first run failed with `E404` on the publish request. The cause is a known interaction:
`actions/setup-node`, given `registry-url`, writes `_authToken=${NODE_AUTH_TOKEN}` into the npmrc it
points `NPM_CONFIG_USERCONFIG` at. With no token set, which is exactly the intended state for
trusted publishing, the client reads that line as authentication already configured, never starts
the OIDC exchange, and publishes with empty credentials. The registry answers `404`, a code that
suggests a missing package rather than a refused login.

Removing that line changed the error, which is what made the second run useful. It failed with
`ENEEDAUTH: This command requires you to be logged in`, from `pnpm publish`. That is the answer to
the question ADR 0014 left open: pnpm 10.20.0 does not perform the OIDC exchange. The message
`changesets/action` prints, `using npm trusted publishing`, describes what the action detected, not
what the publishing client then did.

Two facts then constrain the design, and they point at different tools:

- Only pnpm rewrites the `workspace:*` dependency of `@apollovisionlabs/guide-mui` into a real
  version. `npm publish` would send a manifest asking for a version range npm cannot resolve, and
  the package would be installable by nobody.
- Only npm performs the OIDC exchange, from version 11.5.1 onwards.

## Decision

Each tool does the part it can do. The release step packs every package with `pnpm pack`, which
produces a tarball whose manifest is already correct, and sends that tarball with
`npm publish <tarball> --access public --provenance`, which authenticates through OIDC. npm is
upgraded to its latest version first, because the runner ships one older than 11.5.1.

A version already on the registry is skipped rather than retried, so a push that changes nothing
publishable is a no operation instead of an error.

`changesets/action` is removed. Its version step could not run here, because the organisation does
not allow GitHub Actions to create pull requests, and its publish step is the pnpm path that does
not authenticate. Changesets remains the tool for versioning, run in the repository by a person.

The job's permissions shrink accordingly: `contents: read` and `id-token: write`. Nothing is
written back to the repository any more.

## Consequences

The release path now depends on two package managers rather than one, and on the exact behaviour of
each. That is worth stating plainly, because it is the kind of arrangement someone will later try
to simplify. Collapsing it onto pnpm alone brings back `ENEEDAUTH`; collapsing it onto npm alone
publishes a broken `guide-mui`. Either simplification is a regression, and the tests do not catch
it, because no test publishes.

The step no longer creates git tags or GitHub releases, which `changesets/action` did. Tags can be
added later, in the repository next to the version bump, where the rest of the release bookkeeping
already lives.

The design becomes unnecessary the day pnpm implements the OIDC exchange. Watch the pnpm issue on
trusted publishing, and when it lands, the step collapses back to a single `pnpm publish`.

## Alternatives considered

**Storing an npm token again.** It makes both problems disappear at once, since pnpm publishes
happily with a token. It also restores the long lived scope wide credential that
[ADR 0014](0014-authenticate-releases-with-trusted-publishing.md) removed, and that npm itself
advises against. The complexity here buys the absence of that credential, which is worth more than
a shorter workflow file.

**Replacing the `workspace:*` dependency with a plain version range**, so that `npm publish` alone
would be correct. It would remove the need for pnpm at pack time, at the cost of a version number
in the source that has to be kept in step with the release by hand, which is precisely the class of
mistake Changesets exists to prevent.

**Asking the organisation to allow GitHub Actions to create pull requests**, which would restore
the standard Changesets flow. It changes a security setting for every repository in the
organisation to suit one, and it does not address the authentication problem at all.
