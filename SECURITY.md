---
type: Policy
title: Security policy
description: How to report a vulnerability in the guide packages, which versions are supported, and what the packages do and do not touch.
tags: [security, policy, disclosure]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Security policy

## Reporting a vulnerability

**Placeholder — this section is not yet operational.** The repository has no git remote, so GitHub
private vulnerability reporting cannot be enabled or checked, and no security contact address has
been set. Until a remote exists and either private reporting is turned on or a contact is chosen,
report privately to the repository owner through whatever channel you already have with them, and
do **not** open a public issue.

Whoever adds the remote must replace this paragraph with the real reporting channel. Treat it as
an open task, not as a documented process.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes — the only released line. |

Both packages are at `0.1.0` and have never been published to a registry (see
[INFRA.md](INFRA.md)). Pre-1.0, fixes land on the current minor only.

## What these packages touch

Useful when assessing exposure:

- **No network access.** Neither package issues a request. The only outward signal is the
  `onEvent` callback the consuming application supplies and controls.
- **No telemetry, no analytics, no third-party script.**
- **Storage is opt-in and consumer-chosen.** Nothing is persisted unless the consumer passes a
  `storage` prop. The shipped `createBrowserStorage` writes one `localStorage` key per tour, under
  a namespace the consumer picks; `createMemoryStorage` writes nothing outside the process.
- **What is written** is a tour id, a step index and a status — no user content.
- **DOM reach.** The packages query the document for `[data-guide="…"]`, observe mutations on
  `document.body` while a target is pending, add and remove `aria-describedby` on the highlighted
  element, and append one visually hidden live region to `document.body`. No `innerHTML`, no
  script injection, no `eval`.
- **Step text is rendered as React children**, so it is escaped by React. Step text comes from the
  consumer's own configuration or translation function.

## Scope

In scope: anything in `packages/core` or `packages/mui`. Out of scope: `apps/demo` and `e2e/`,
which are development-only and never published.

The rules contributors are expected to follow — the invariants that keep the list above true — are
in [docs/security.md](docs/security.md).
