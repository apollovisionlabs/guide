---
type: Reference
title: MUI
description: The Material UI component library that @guide/mui renders with.
resource: https://mui.com
tags: [reference, mui, ui]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# MUI

The component library `@guide/mui` builds on. Only a small surface is used, namely `Box`, `Button`,
`IconButton`, `Paper`, `Popper`, `Typography`, plus `alpha` and `useTheme` from
`@mui/material/styles`, which is what makes supporting both MUI 7 and MUI 9 possible
([ADR 0006](../adr/0006-support-two-mui-majors.md)).

**Where it is defined**: linked from the README; declared as a peer dependency
`"@mui/material": "^7 || ^9"` in `packages/mui/package.json`.
