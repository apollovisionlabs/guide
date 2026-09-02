---
type: Reference
title: Changesets configuration schema
description: JSON schema for the Changesets configuration file that drives versioning in this monorepo.
resource: https://unpkg.com/@changesets/config@3.0.0/schema.json
tags: [reference, release, versioning, tooling]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Changesets configuration schema

The schema `.changeset/config.json` declares through its `$schema` field. Useful when changing the
release configuration. The current settings are `changelog: "@changesets/cli/changelog"`,
`commit: false`, `access: "public"`, `baseBranch: "main"`,
`updateInternalDependencies: "patch"`.

Note that no release has ever been executed from this repository; see
[INFRA.md](../../INFRA.md) before assuming a release process exists.

**Where it is defined**: the `$schema` field of `.changeset/config.json`.
