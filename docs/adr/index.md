# Architecture decision records

Structural decisions with evidence in the code. Write a new one only for a structural or
architectural decision: a new pattern or boundary, a significant dependency, an irreversible
choice. Routine features and bug fixes get no ADR. Use [template.md](template.md); number
sequentially, zero-padded.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-headless-core-and-rendering-layer.md) | Split a headless core from the rendering layer | stable |
| [0002](0002-logical-targets-via-data-attribute.md) | Resolve targets by logical key, never by CSS selector | stable |
| [0003](0003-delegated-navigation.md) | Delegate navigation instead of depending on a router | stable |
| [0004](0004-missing-target-policy.md) | Wait for a missing target, then apply a policy | stable |
| [0005](0005-disable-treeshake-to-keep-use-client.md) | Keep treeshake disabled to preserve the use client banner | stable |
| [0006](0006-support-two-mui-majors.md) | Support two MUI majors and verify the second in CI | stable |
| [0007](0007-pluggable-persistence-no-network.md) | Persistence is an interface, and the packages make no network calls | stable |
| [0008](0008-accessibility-in-the-core.md) | Accessibility lives in the core, and interactive steps are non-modal | stable |
| [0009](0009-typecheck-core-through-sources.md) | Typecheck the MUI package against the core's sources | stable |
| [0010](0010-shipped-package-readmes-exempt-from-frontmatter.md) | Exempt the shipped package READMEs from the OKF frontmatter rule | stable |
| [0011](0011-move-to-apollo-vision-labs.md) | Move to the Apollo Vision Labs organisation | stable |
| [0012](0012-publish-under-the-apollovisionlabs-scope.md) | Publish under the apollovisionlabs scope | stable |
| [0013](0013-publish-from-a-release-workflow.md) | Publish from a release workflow driven by Changesets | stable |
