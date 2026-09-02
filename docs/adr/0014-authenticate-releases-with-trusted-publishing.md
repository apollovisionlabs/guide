---
type: ADR
title: 0014. Authenticate releases with npm trusted publishing
description: The release workflow authenticates through OIDC rather than a stored npm token, which means the first publish of each package has to be done by hand.
tags: [adr, ci, release, security, npm, oidc]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T16:03:42Z
  directed_by: human:remy dème
---

# 0014. Authenticate releases with npm trusted publishing

## Status

Stable. Supersedes the authentication part of
[ADR 0013](0013-publish-from-a-release-workflow.md); everything else in 0013 still holds.

## Context

ADR 0013 authenticated the release workflow with `NPM_TOKEN`, a long lived npm automation token
held in the repository secrets. When the token was being created, npm itself objected:

> There are security risks with this option. For automation or CI/CD uses, please use Trusted
> Publishing instead.

The objection is correct. A long lived publish token is a credential that survives in a settings
page, can be copied, and grants publish rights on the whole scope until someone remembers to rotate
it. Trusted publishing replaces it with an OIDC exchange: GitHub mints a token scoped to this
repository and this workflow, npm trades it for a credential that lives for the length of one
publish, and nothing is stored anywhere.

Three facts were checked before changing the design, because two of them constrain it:

- Trusted publishing requires the package to already exist on the registry. The trusted publisher
  is configured in the package's own settings, so a package that has never been published has no
  settings page to configure. This is a known and open limitation on npm's side.
- OIDC publishing is reported working in pnpm 10, the major pinned in this repository, and broken
  in pnpm 11.0.8.
- npm's own documentation covers the npm CLI and does not mention pnpm, so the pnpm path rests on
  reported behaviour rather than on a supported guarantee.

## Decision

The release workflow authenticates through trusted publishing. It requests `id-token: write`,
`actions/setup-node` is given `registry-url`, and no npm token is stored in the repository.

Because the first version of a package cannot be published this way, bootstrapping is explicitly a
manual act: a maintainer publishes `0.1.0` of each package once from their own machine, with their
own account and its second factor. A trusted publisher is then attached to each package, and every
later release goes through the workflow.

The gate on the release step moves from the presence of a secret to a repository variable,
`RELEASE_ENABLED`. It is set to `true` once both packages exist and both have a trusted publisher.
Until then the step is skipped with a warning and the run stays green, so a public repository is
not left permanently red by a configuration nobody has completed yet.

## Consequences

No credential is stored, so there is nothing to leak from this repository and nothing to rotate.
The publish right is bound to a repository and a workflow file rather than to a person's token,
which also means a fork cannot publish.

The bootstrap is a manual step that has to be done twice, once per package, and it is the one
moment where a human's credentials touch the registry. It is worth writing down that this is not an
oversight but a limitation of npm today.

Provenance is expected to come with trusted publishing, but it has not been observed here. Whether
an attestation is actually attached through `pnpm changeset publish` must be checked on the npm
page of the first package published this way, and `INFRA.md` corrected to record what was seen. A
provenance badge that nobody verified is worth no more than the claim it replaces.

A pnpm major upgrade is now a change that can break releases silently, since OIDC support differs
between pnpm 10 and 11. It has to be revalidated against the registry rather than treated as
routine maintenance.

## Alternatives considered

**Keeping the long lived token.** It publishes the first version without ceremony, which is the one
thing trusted publishing cannot do. It also stores a scope wide credential indefinitely, which is
what npm advises against, and the convenience is bought once while the risk is carried forever.

**Publishing the first version from the workflow with a short lived token, then removing it.** It
avoids the manual bootstrap, at the cost of creating exactly the credential the change exists to
avoid, and of a cleanup step that is easy to forget. A one time manual publish is smaller and
leaves nothing behind.

**Switching the release step from pnpm to the npm CLI**, whose trusted publishing support is
documented rather than merely reported. It would mean running a package manager the repository does
not otherwise use, purely inside the release step. Worth doing if the pnpm path turns out not to
work, and the fallback is recorded here so the option is not rediscovered from scratch.
