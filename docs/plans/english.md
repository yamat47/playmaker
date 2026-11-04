# Switch the repository to English and add a `locale` option

Decided on 2026-11-04. Delete this file when the last step below is merged.

## Goal

The library becomes an English tool: the built-in UI is English by default, every document and
comment in the repository is English, and Japanese stays available as a translation the host
turns on at construction time. The public demo (playmaker-demo) is built on this afterwards.

What stays Japanese: the git history and the `ja` dictionary.

## Inventory (as of main at 4836ae4)

| What | Size | Treatment |
|---|---|---|
| UI strings in `browser/ui/toolbar.ts`, `browser/ui/property-panel.ts`, swatch names in `browser/theme/palette.ts`, zone names in `common/model/play-data.ts` | about 45 | Move into a dictionary; `en` default, `ja` bundled |
| Thrown errors and `console.warn` (`Playmaker  ...`) | 9 | English, not translated (they are for developers) |
| Command labels in `common/commands/*` and the default formation name in `common/formations/formation.ts` | 9 | English, not translated (an internal error message and a normalisation default) |
| `summary` of the play presets in `common/plays/presets.ts` | 18 | Rewrite in English only; presets are going to be removed later |
| JSDoc on the public API (`playmaker.ts`, exported types in `common/`); 107 lines reach `dist/playmaker.d.ts` | 107 lines | English |
| Documents: `README.md`, `library/README.md`, `docs/prd.md`, `docs/design.md`, `CLAUDE.md`, `.claude/rules/testing.md`, `.claude/agents/security-reviewer.md`, `.github/pull_request_template.md`, `description` in `library/package.json` | about 970 lines | English |
| Source comments outside tests | about 680 lines | English |
| Test names and comments inside tests; 11 role-name queries that use Japanese labels | 538 names | English |
| Comments in configuration: `Makefile`, `docker/*`, `.github/*`, `library/biome.jsonc`, `library/vite.config.ts`, `library/src/styles.css`, `.devcontainer/*`, `library/scripts/*` | about 180 lines | English |
| `library/demo/index.html` and `library/demo/main.ts` | about 45 lines | English; `?locale=ja` switches the dictionary for checking |

## Design of the translation

- `PlaymakerOptions.locale?: "en" | "ja"`, default `"en"`. The locale is fixed at construction;
  switching means constructing again (the host already knows its language at start-up, so there
  is no `setLocale`).
- `src/browser/i18n/messages.ts` holds the `Messages` type and `en`; `src/browser/i18n/ja.ts`
  holds `ja`. `Toolbar` and `PropertyPanel` receive a `Messages` and hold no literal text.
  Both dictionaries are bundled; together they are a few kilobytes.
- Sentences whose word order differs between the languages (`red outline` / `赤の枠線`,
  `Up to 22 players` / `選手は 22 人までです`) are functions in the dictionary.
- `FIELD_ZONE_LABELS` stays exported with English labels; the UI reads zone names from the
  dictionary instead.
- `docs/prd.md` 8.3 changes from "no i18n, Japanese UI only" to "English by default, Japanese
  bundled, chosen with `locale`"; 6.5 follows. `docs/design.md` gets a "Locale" section.
- Version 0.2.0, because the default language changes.

## Steps

Each step is one pull request unless noted. From step 1 on, commits and pull requests are
written in English (the `writing-conventions` skill follows the repository's language).

1. docs: translate every document and every configuration comment listed above. No behaviour
   change. This commit also adds this plan.
2. feat(i18n): the `locale` option, English default, `ja` dictionary, browser tests with
   English names plus one for `ja`, the PRD and design revisions, the README usage and its "Supported environments"
   sentence about i18n, the demo in English with `?locale=ja`.
3. docs(api): JSDoc of the public API and the source comments, split in two pull requests
   (`common/`, then `browser/` and the entry) so each stays reviewable.
4. Tag `v0.2.0` once step 3 is merged, so the published `d.ts` and README are English.
5. test: test names and comments inside tests.
6. Afterwards, outside this plan: shrink `library/demo` to a development playground and build
   playmaker-demo on 0.2.0.
