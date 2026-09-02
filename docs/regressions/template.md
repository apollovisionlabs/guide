---
type: Regression Template
title: <Short name of the broken behavior>
description: "<One sentence: what broke.>"
tags: [regression]
status: stable
generated:
  by: <MODEL-ID>
  at: <ISO-8601>
  directed_by: human:<ID>
---

# <Broken behavior>

- **Symptom**: what users/tests observed, and since when.
- **Root cause**: the actual mechanism, with file paths.
- **Fix**: commit/PR reference.
- **Test added**: the test that now pins this behavior (path). If none, why.
