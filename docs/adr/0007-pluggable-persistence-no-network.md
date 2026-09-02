---
type: ADR
title: 0007. Persistence is an interface, and the packages make no network calls
description: Progress is stored through a two-method GuideStorage interface the consumer supplies; the packages never talk to a server.
tags: [adr, architecture]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0007. Persistence is an interface, and the packages make no network calls

## Context

A tour that restarts from step one after a page reload is worse than no tour. But where progress
belongs, whether in memory, in `localStorage`, or in a user profile on the consumer's own server, is
the consumer's decision, and one with privacy implications the library cannot make on their behalf.

## Decision

`GuideStorage` (`packages/core/src/types.ts`) is the entire contract:

```ts
read(tourId: string): Promise<TourProgress | null>
write(tourId: string, progress: TourProgress): Promise<void>
```

`packages/core/src/storage.ts` ships two implementations, `createMemoryStorage` and
`createBrowserStorage(namespace)`. Neither performs network access, and neither package makes a
request of any kind. Nothing is persisted at all unless the consumer passes a `storage` prop.

Failure is non-fatal: a read that throws starts the tour from the beginning, a write that throws is
swallowed, and the provider warns once per session.

## Consequences

- A server-backed implementation is a dozen lines of consumer code, shown in the README, and it is
  the consumer's own request, on their own origin, with their own credentials.
- The library can be dropped into a privacy-sensitive application without a data-flow review of the
  package itself. This invariant is enforced in the [security playbook](../security.md).
- Both methods are async even for `localStorage`, so the two implementations share one interface.
- Progress is written on every step change while a tour runs. A remote implementation should
  tolerate that frequency, or debounce on its own side.
