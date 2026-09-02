---
type: Playbook
title: Quality score grid
description: Weighted 0-5 scoring grid for evaluating significant changes; shared structure across LogHosp repos for comparable scores.
tags: [quality, scoring, review, convention]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Quality score grid

A shared convention for scoring a change (PR, module, or feature) so evaluations by different agents are comparable across repos. The structure (categories, weights, scale, bands, security gate) is shared; only the per-category criteria references point at THIS repo's playbooks.

## When to apply

Consistent with the Documentation Map contract - **not on every PR**:

- **On request** - the user or a reviewer asks for a quality score.
- **On significant PRs** - a new module/section, a change touching auth/RBAC/scoping, a large refactor, a new external integration.

Routine features and bug fixes get no score by default.

## Where results go

In the **PR description or a review comment** - never in committed files. The repo stores the grid, not the measurements.

## Categories and weights

| # | Category | Weight | Criteria source |
|---|----------|-------:|-----------------|
| 1 | Correctness & tests | 30% | [code-quality.md](code-quality.md) test expectations, [code-review.md](code-review.md) |
| 2 | Security & access-control compliance | 25% | [security.md](security.md) invariants, [code-review.md](code-review.md) security items |
| 3 | Architecture conformity | 20% | [ARCHITECTURE.md](../ARCHITECTURE.md), [ADRs](adr/index.md) |
| 4 | Code clarity & conventions | 15% | [code-quality.md](code-quality.md) conventions |
| 5 | Documentation & ADR discipline | 10% | Documentation Map contract in `AGENTS.md` / `CLAUDE.md` |

## Scoring scale (0-5 per category)

0 = criterion absent or actively broken; 2 and 4 interpolate between the anchors. Write anchors for 1 / 3 / 5 per category, grounded in THIS repo's specifics. The shape:

- **1** - the category's core rule is violated (no tests / a guard or scoping bypassed / fights the architecture / fails lint / a doc trigger ignored).
- **3** - the rules pass with minor, named debt.
- **5** - rules pass, edge cases covered, deviations explicitly justified; nothing for a senior reviewer to flag.

## Computing the total

`total = sum(score_i / 5 * weight_i) * 100`, i.e. with weights 30/25/20/15/10:

```
total = score1*6 + score2*5 + score3*4 + score4*3 + score5*2   (out of 100)
```

Report per-category scores with one line of justification each (citing files), and the total.

Verdict bands (shared across repos): **>= 85** merge-ready; **70-84** acceptable with noted follow-ups; **50-69** needs rework before merge; **< 50** do not merge. A category-2 (security) score **<= 2 caps the verdict at "needs rework"** regardless of the total - security is a gate, not a trade-off.
