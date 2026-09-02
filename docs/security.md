---
type: Playbook
title: Security playbook
description: The invariants that keep these packages free of network access, data collection and licence contamination.
tags: [security, privacy, licensing, playbook]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Security playbook

This is a client-side library with no server, no account, and no access control of its own. Its
security surface is therefore unusual: what matters is what it *refuses* to do inside somebody
else's application. Reporting and supported versions are in [SECURITY.md](../SECURITY.md).

## Invariants

Each of these holds in the current sources. Breaking one is a breaking change to the product's
promise, not a refactor.

1. **No network access from either package.** There is no `fetch`, no `XMLHttpRequest`, no
   `WebSocket`, no image beacon in `packages/`. The only outward signal is the consumer's own
   `onEvent` callback. A dependency that phones home is equally disqualified.
2. **No data collection.** Nothing about the user is read, derived, or stored beyond a tour id, a
   step index and a status. Do not add anything that identifies a person, a session, or a page's
   content.
3. **Persistence stays opt-in and pluggable.** `GuideStorage` is the whole contract
   (`packages/core/src/types.ts`). The shipped implementations are memory and `localStorage`.
   Never make one of them the default when no `storage` prop is passed.
4. **Storage failure is never fatal.** Reads and writes are wrapped, a failure warns once, and the
   tour continues. A blocked or full `localStorage` must not break a consumer's application.
5. **No string is turned into markup.** Step text is rendered as React children. There is no
   `innerHTML`, no `dangerouslySetInnerHTML`, no `eval`, no dynamic `<script>`.
6. **Selectors are built, never concatenated blind.** `packages/core/src/selector.ts` escapes the
   target key with `CSS.escape` (with a manual fallback) before interpolating it into
   `[data-guide="…"]`. Both runtime resolution and development validation must keep using that one
   builder — a divergence would make a key valid on one path and a `SyntaxError` on the other.
7. **DOM mutation of consumer elements is minimal and reversed.** The popover sets
   `aria-describedby` on the highlighted element and removes it on cleanup; the announcer appends
   one visually hidden node. Nothing else in the consumer's tree is written to.
8. **The `MutationObserver` is bounded.** It observes `document.body` only while a target is
   pending, and every effect that starts one disconnects it on cleanup.

## Licence discipline is a security control here

Consulting AGPL or commercially licensed source would contaminate an MIT package and expose every
downstream consumer to a licensing claim. The rule is absolute and is repeated in
[CONTRIBUTING.md](../CONTRIBUTING.md):

- **Never open the source of Intro.js or Shepherd.js**, for any reason, including "just to see how
  they solved it".
- MIT prior art may be read and attributed: driver.js, react-joyride, reactour.
- Every new dependency needs a permissive licence checked before it is added.

## Reviewing a change against this playbook

Ask, in order: does it add a request? does it store something new? does it write to the consumer's
DOM? does it build a selector by hand? does it add a dependency? A "yes" to any of these needs an
explicit justification in the pull request, and a "yes" to the first two almost certainly means the
change does not belong in this library.
