# Playmaker

A UI-framework-agnostic TypeScript library for creating and displaying American football play diagrams.
The requirements are in `docs/prd.md`, the current design and its rationale in `docs/design.md`,
and the test conventions in `.claude/rules/testing.md` (loaded automatically when you touch tests).

## Where the conventions live

- Follow the `writing-conventions` skill for comments, commits, and PRs, and the `typescript-idioms` skill for TypeScript
- Everything written around code (documents, comments, test names, commits, PRs) is in English. The commit history
  before the switch to English is Japanese; do not infer the language from it
- Measure the value of tests with the `test-audit` skill. Check Dependabot PRs with the `review-dependency-bump` skill,
  and skill update PRs with the `review-skill-update` skill
- In `.claude/skills/`, use the imported version as is for any skill whose frontmatter `metadata.github-repo` is github-toolkit.
  Do not edit it directly. Write the rules specific to this repository in this file and in `.claude/rules/`; when they conflict with a skill, these take precedence
- Read the relevant section of `docs/design.md` before changing `library/src/`. If you change a design decision written in `docs/design.md` (layer boundaries, data shapes, public API contracts,
  toolchain workarounds, and so on), fix `docs/design.md` in the same PR

## Directories

| Path | Contents |
|---|---|
| `library/` | The library itself (npm package). `src/` `demo/` plus the package.json, tsconfig, vite, and biome configuration |
| `docker/` | Development image and compose |
| `docs/` | Requirements, design, and plans |
| `Makefile` | Entry point for development commands |

Paths such as `src/` `demo/` `vite.config.ts` in the conventions and documentation are relative to `library/`.

Keep only in-progress plans in `docs/plans/`, and delete them when complete (the history stays in git).

## Always run commands through make

Node and pnpm are not installed on the host. The toolchain exists only inside the Docker container, and
the `Makefile` invokes it from the host with `docker compose -f docker/compose.yaml run` (pnpm runs in `library/`).
**Do not run `pnpm` `npm` `npx` `node` `vitest` `tsc` `biome` directly on the host** (`permissions.deny` in `.claude/settings.json` rejects them).

| Goal | Command |
|---|---|
| Run every check CI runs | `make check` |
| Tests (with the coverage gate) | `make test` |
| Tests for a single file | `make test FILE=library/src/common/base/event.test.ts` |
| Browser tests (Chromium) | `make test-browser` |
| Type check / lint / auto-fix | `make typecheck` / `make lint` / `make fix` |
| Build the library | `make build` (`library/dist/`) |
| Add or update dependencies | `make pnpm ARGS="add -D <pkg>"` (the lockfile is also updated on the host) |
| Other pnpm commands | `make pnpm ARGS="exec vitest run --reporter=verbose"` and so on |
| Dev server for the demo | `make up` (http://localhost:5173) / `make logs` / `make down` |
| First run, or after changing the Dockerfile | `make setup` |
| Regenerate the field font | `make font` (`library/src/assets/`) |

- When a skill or agent procedure tells you to run `pnpm run <script>`, map it to the make target in the table above
  (for example, the verification step in create-pr and the "changed gate" in test-audit are `make check`, and a single test file is `make test FILE=<file>`)
- `node_modules` lives inside a Docker volume. `library/node_modules/` on the host is an empty mount point, so
  use `make pnpm ARGS="exec ls node_modules/<pkg>"` when you need to read its contents
- Dependabot does not bump pnpm itself or Node (for Node, only the image is bumped). Change `packageManager` in `library/package.json` for pnpm,
  and `.node-version` and `docker/Dockerfile` for Node, then run `make setup` because they are baked into the image
- Dependabot bumps playwright, but the Chromium for browser tests is baked into the image to match that version, so run `make setup` after a bump
- The procedure for checking the demo in a browser is in the `run-demo` skill
- Docker does not run in the cloud version of Claude Code. The SessionStart hook (`docker/cloud-session-setup.sh`)
  installs the Node from `.node-version`, pnpm, and the dependencies, and sets `IN_CONTAINER=1`, so make works as is.
  The host-only targets that operate Docker (`setup` `up` `down` `logs` `sh` `clean`) are not available, though
