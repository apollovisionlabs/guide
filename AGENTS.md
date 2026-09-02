# AGENTS

`guide` is an MIT-licensed pnpm monorepo publishing two React packages: `@guide/core`, a headless
product-tour engine, and `@guide/mui`, its MUI rendering layer. `apps/demo` is a private showcase
that doubles as the Playwright fixture, and `e2e/` is the end-to-end suite.

## Before you write code

- Node >= 22, pnpm >= 10.6.5. Install with `pnpm install`.
- Verification, in this order: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. The
  build must come before the end-to-end run, because the demo resolves the packages through
  `dist`.
- Commit messages are in French, conventional-commit style (`feat(core):`, `fix(mui):`, `test:`,
  `chore:`, `docs:`). Branches are `<kind>/<slug>`. The repository has no git remote.
- Never open the source of Intro.js or Shepherd.js: they are AGPL or commercial and would
  contaminate this MIT package. driver.js, react-joyride and reactour are MIT and may be read.

## Documentation Map

**Read first**: before starting any task, read `docs/index.md` (the OKF documentation map), plus the playbook relevant to the task: `docs/security.md` (storage, DOM, dependency and network work), `docs/code-review.md` (reviews), `docs/code-quality.md` (writing code), `docs/migrations.md` (dependency and public API migrations).

**Contribute only on these triggers** - most PRs change no documentation; that is the expected default:

- **`docs/adr/`**: write an ADR only for a structural/architectural decision - a new pattern or boundary, a significant dependency, a change to the layering between `@guide/core` and a rendering package, an irreversible choice. Routine features and bug fixes get NO ADR.
- **`docs/plans/in-progress/`**: create a plan only for multi-step work spanning several PRs/sessions; move it to `done/` when finished.
- **`docs/regressions/`**: add an entry only when fixing a regression (previously working behavior that broke), using the template.
- **Playbooks** (`security.md`, `code-review.md`, `code-quality.md`, `migrations.md`): update only when a rule or invariant changes, or a new one is discovered.
- **Always**: whenever any doc changes, add an entry to `docs/log.md` and keep `docs/index.md` in sync.

The three `README.md` copies (root, `packages/core`, `packages/mui`) are identical and must stay
so; they are the public API reference and the npm package front page.
