---
type: ADR
title: 0016. One storage contract for tours and checklists
description: GuideStorage became generic over the stored value and the caller-namespaced key, so tours and checklists share one persistence interface instead of two.
tags: [adr, architecture, persistence, checklist]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-03T13:30:00Z
  directed_by: human:remy dème
---

# 0016. One storage contract for tours and checklists

## Status

Stable. Widens the interface [ADR 0007](0007-pluggable-persistence-no-network.md) introduced.

## Context

[ADR 0007](0007-pluggable-persistence-no-network.md) fixed `GuideStorage` to one shape:

```ts
read(tourId: string): Promise<TourProgress | null>
write(tourId: string, progress: TourProgress): Promise<void>
```

The checklist feature needed to persist a second, unrelated shape, `ChecklistProgress`
(`packages/core/src/types.ts`), keyed by checklist id rather than tour id. `createMemoryStorage`
and `createBrowserStorage` (`packages/core/src/storage.ts`) already did nothing shape-specific
internally; only the type signature forced `TourProgress`.

## Decision

`GuideStorage` (`packages/core/src/types.ts`) becomes generic over the stored value, and the key
becomes a plain, caller-namespaced string instead of a bare tour id:

```ts
interface GuideStorage {
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, value: T): Promise<void>
}
```

`GuideProvider` reads and writes tour progress under `tour:<id>`; `ChecklistProvider` reads and
writes checklist progress under `checklist:<id>`. Both namespaces share the same storage instance
and the same two implementations, `createMemoryStorage` and `createBrowserStorage`.

Neither implementation validates what it stores; they stay dumb pipes. Validation moved to the
read site instead: `isTourProgress` and `isChecklistProgress` (`packages/core/src/storage.ts`)
check the shape of whatever comes back before either provider trusts it. `isTourProgress` already
existed as an unexported check; this decision is also what made it worth exporting, since a
consumer's own storage code can now hit the same shape question `ChecklistProvider` does.

## Consequences

Two breaks follow, and both are worth stating plainly:

- **A custom `GuideStorage` implementation must widen its signature.** Anyone who wrote
  `read(tourId: string): Promise<TourProgress | null>` against the old interface now fails to
  typecheck against `read<T>(key: string): Promise<T | null>`. The fix is mechanical: make both
  methods generic and stop assuming the key is a tour id.
- **Tour progress stored under the old key is orphaned.** The old contract stored under the bare
  tour id; the new one stores under `tour:<id>`. A value written by a pre-0.2.0 version of this
  library sits at a key nothing reads any more. A user in the middle of a tour when the upgrade
  ships restarts that tour once, from the beginning, the next time they open it. Nothing crashes:
  `storage.read('tour:<id>')` on a store that only has `<id>` returns `null`, which is exactly the
  first-visit case the provider already handles.

What this buys back: a project wiring its own backend to `GuideStorage` writes one implementation,
not two, and the checklist inherits the "no network calls" property
[ADR 0007](0007-pluggable-persistence-no-network.md) established for tours without a separate
decision.

Values read from storage were already untrusted for tours (`isTourProgress`, added when the
generic contract was drafted); the checklist gets the same treatment for free, by construction,
because the read site is the enforcement point rather than the storage implementation.

## Alternatives considered

**A second `ChecklistStorage` interface**, shaped like the old `GuideStorage`, alongside it. It
would have avoided both breaking consequences above. It was rejected because a project wiring
persistence to its own backend, the case [ADR 0007](0007-pluggable-persistence-no-network.md)
exists to serve, would then implement two interfaces to do one job: read a value by key, write a
value by key. The duplication would only grow the next time the library persists a third kind of
progress.
