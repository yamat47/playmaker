# 依存・Node 一括最新化プラン

## Context

Dependabot の open PR が 3 件たまっており、一気に解消したい。さらに「せっかくなら最新に全て上げる」方針（[[playmaker-always-latest-deps]]）に沿って、Dependabot が扱わない **pnpm 本体** と **Node ランタイム** も同時に最新へ引き上げる。

`#47`（dev-deps グループ）と `#48`（@types/node メジャー）は **どちらも `pnpm-lock.yaml` と `package.json` の devDependencies ブロックを編集する**ため、片方をマージするともう片方が必ずコンフリクトし、`@dependabot rebase` 待ちが複数ラウンド発生する。これを避けるため、**ローカルの統合ブランチ 1 本に全変更をまとめ、単一 CI 検証 → 単一 PR** で解決し、3 つの Dependabot PR は close する。

### 現状（調査済み）
- open PR: **#46** actions/checkout 6→7（CI のみ・他と非干渉）, **#47** dev-deps グループ, **#48** @types/node 25.9.3→26.0.0
- 3 PR とも `MERGEABLE` / `CLEAN`、main の CI は success
- **#47 + #48 をマージすれば npm 依存は全て真の最新**（typescript 6.0.3 / vite 8.0.16 / vite-plugin-dts 5.0.2 はレンジ内で既に最新。npm registry で確認済み。pending major は他に無し）
- Dependabot 対象外: pnpm `packageManager@11.1.2` → 最新 **11.8.0**、Node CI pin `25` / local 25.8.0 → 最新 **26.3.1**

## 決定事項（ユーザー合意済み）
- **戦略**: 統合 1 本にまとめる
- **Node**: CI 実行環境を 26 へ、`engines` は `>=24` 維持（ライブラリ利用者を縛らない）

## 変更内容

### 1. `package.json`
- `devDependencies` を #47 + #48 の最終状態へ:
  - `@biomejs/biome` `^2.4.16` → `^2.5.0`
  - `@microsoft/api-extractor` `^7.58.8` → `^7.58.9`
  - `@vitest/coverage-v8` `4.1.8` → `4.1.9`（固定指定のまま）
  - `vitest` `^4.1.8` → `^4.1.9`
  - `@types/node` `^25.9.3` → `^26.0.0`
- `packageManager` `pnpm@11.1.2` → `pnpm@11.8.0`
- `engines.node` は `>=24` のまま **変更しない**

### 2. `pnpm-lock.yaml`
- 手書きせず `pnpm install`（lockfile-only ではなく通常 install）で再生成し、上記レンジに追従させる。

### 3. `.github/workflows/ci.yml`
- `actions/checkout@v6` → `@v7`（#46 相当）
- `Setup Node.js` の `node-version: 25` → `26`
- （任意・コミット分離）`env.FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` は checkout@v7 / setup-node@v6 が既定で Node24 ランタイムのため不要の可能性。本プランでは**触らない**（別途検証課題として残す）。

### 4. ローカル開発環境
- 必須ではないが、ローカル Node を 26 系へ上げて検証するのが望ましい（CI と揃える）。最低でも `pnpm` は corepack 経由で 11.8.0 を使う。

## コミット分割（論理単位）
1. `chore(deps-dev): bump dev-dependencies to latest`（biome/api-extractor/coverage-v8/vitest + lockfile）
2. `chore(deps-dev): bump @types/node to 26`（+ lockfile 差分）
3. `chore(deps): bump pnpm to 11.8.0`（packageManager + lockfile)
4. `ci: bump actions/checkout to v7 and Node to 26`

> 実装時は `/git:create-pr`（[[create-pr]] スキル）でカバレッジ確認・並列ローカル CI・論理コミット分割・push・PR 作成まで一括実行できる。

## 検証（end-to-end）
ローカルで CI 同等を全て緑にしてから push する:
```
corepack use pnpm@11.8.0     # or: corepack prepare pnpm@11.8.0 --activate
pnpm install                 # lockfile 再生成
pnpm run typecheck
pnpm run lint
pnpm run test                # vitest run --coverage
pnpm run build               # tsc --noEmit && vite build
```
- 全て pass を確認（特に biome 2.5.0 で新規 lint 指摘が出ないか、vitest 4.1.9 でテストが通るか）
- `local-ci-runner` エージェントで並列検証も可。

## PR / クリーンアップ
- main へ単一 PR を作成。本文に「Supersedes #46, #47, #48 + pnpm 11.8.0 + Node 26」と明記。
- マージ後（または PR 本文/コメントで）`gh pr close 46 47 48 --comment "Superseded by #<new>"` で 3 件を close、対応する dependabot ブランチは自動/手動で削除。

## ロールバック観点
- biome 2.5.0 の lint 差分が大きい場合のみコミット 1 を分離して個別 revert 可能にする。
- @types/node 26 で型エラーが出た場合はコミット 2 を切り戻し、#48 相当のみ保留して残り 3 件を先行。
