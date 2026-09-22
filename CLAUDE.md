# Playmaker

アメフトのプレー図を作成・表示する、UI フレームワーク非依存の TypeScript ライブラリ。
要件は `docs/prd.md`、設計判断の経緯は `docs/plans/implementation-roadmap.md`、
コーディング規約は `.claude/rules/`（対象ファイルを触ると自動で読み込まれる）。

## ディレクトリ

| パス | 中身 |
|---|---|
| `library/` | ライブラリ本体（npm パッケージ）。`src/` `demo/` と package.json・tsconfig・vite・biome の設定 |
| `docker/` | 開発用イメージと compose |
| `docs/` | 要件・設計・計画 |
| `Makefile` | 開発コマンドの入口 |

規約やドキュメントに出てくる `src/` `demo/` `vite.config.ts` などは `library/` からの相対パス。

`docs/plans/` には実行中の計画だけを置き、完了したら削除する（経緯は git 履歴に残る）。
全体見直しの間は `docs/plans/overhaul-backlog.md` が進め方の正で、`implementation-roadmap.md` より優先する。

## コマンドは必ず make 経由

Node / pnpm はホストに入っていない。ツールチェーンは Docker コンテナの中にだけあり、
`Makefile` がホストから `docker compose -f docker/compose.yaml run` で呼び出す（pnpm は `library/` で動く）。
**`pnpm` `npm` `npx` `node` `vitest` `tsc` `biome` をホストで直接実行しない**（`.claude/settings.json` の `permissions.deny` で拒否される）。

| やりたいこと | コマンド |
|---|---|
| CI と同じ検証を全部 | `make check` |
| テスト（カバレッジゲート込み） | `make test` |
| テストを 1 ファイルだけ | `make test FILE=library/src/common/event/emitter.test.ts` |
| 型検査 / lint / 自動修正 | `make typecheck` / `make lint` / `make fix` |
| ライブラリのビルド | `make build`（`library/dist/`） |
| 依存の追加・更新 | `make pnpm ARGS="add -D <pkg>"` → lockfile もホストに反映される |
| その他の pnpm コマンド | `make pnpm ARGS="exec vitest run --reporter=verbose"` など |
| demo の dev サーバー | `make up`（http://localhost:5173）/ `make logs` / `make down` |
| 初回・Dockerfile 変更後 | `make setup` |

- skill や agent の手順が `pnpm run <script>` を指示していたら、上の表の make ターゲットに読み替える
  （例: create-pr の検証ステップは `make check`）
- `node_modules` は Docker volume の中にある。ホストの `library/node_modules/` は空のマウントポイントなので、
  中身を読みたいときは `make pnpm ARGS="exec ls node_modules/<pkg>"` を使う
- demo をブラウザで確かめる手順は `run-demo` skill にある
