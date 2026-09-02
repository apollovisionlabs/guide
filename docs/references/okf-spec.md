---
type: Reference
title: OKF specification
description: The official Open Knowledge Format specification this documentation bundle conforms to.
resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
tags: [reference, okf, specification, format]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# OKF specification

The Open Knowledge Format (OKF) v0.2 specification, maintained by Google Cloud Platform in the [knowledge-catalog repository](https://github.com/GoogleCloudPlatform/knowledge-catalog). Every document in this bundle follows it: YAML frontmatter with a required `type`, reserved `index.md`/`log.md` files, bundle-relative cross-links, `sources:`/`generated:`/`verified:` provenance fields.

LogHosp extension on top of the spec: `generated.directed_by: human:<id>` records the human who piloted the generating model (conformant per OKF §Extensions - consumers preserve unknown keys).
