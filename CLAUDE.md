# Playmaker

アメフトのプレー図を作成・表示する、UI フレームワーク非依存の TypeScript ライブラリ。
要件は `docs/prd.md`、今の設計とその理由は `docs/design.md`、
テストの規約は `.claude/rules/testing.md`（テストを触ると自動で読み込まれる）。

## 規約の置き場

- コメント、コミット、PR の書き方は `writing-conventions` skill、TypeScript の書き方は `typescript-idioms` skill に従う
- `.claude/skills/` のうち frontmatter の `metadata.github-repo` が github-toolkit のものは、取り込んだ版をそのまま使う。
  直接書き換えない。このリポジトリ固有の決まりはこのファイルと `.claude/rules/` に書き、skill と食い違うときはこちらを優先する
- `library/src/` を変える前に `docs/design.md` の該当する節を読む。層の分け方、データの形、公開 API の契約、
  ツールチェーンの回避策など、`docs/design.md` に書いてある設計を変えたら、同じ PR で `docs/design.md` も直す

## ディレクトリ

| パス | 中身 |
|---|---|
| `library/` | ライブラリ本体（npm パッケージ）。`src/` `demo/` と package.json・tsconfig・vite・biome の設定 |
| `docker/` | 開発用イメージと compose |
| `docs/` | 要件・設計・計画 |
| `Makefile` | 開発コマンドの入口 |

規約やドキュメントに出てくる `src/` `demo/` `vite.config.ts` などは `library/` からの相対パス。

`docs/plans/` には実行中の計画だけを置き、完了したら削除する（経緯は git 履歴に残る）。

## コマンドは必ず make 経由

Node / pnpm はホストに入っていない。ツールチェーンは Docker コンテナの中にだけあり、
`Makefile` がホストから `docker compose -f docker/compose.yaml run` で呼び出す（pnpm は `library/` で動く）。
**`pnpm` `npm` `npx` `node` `vitest` `tsc` `biome` をホストで直接実行しない**（`.claude/settings.json` の `permissions.deny` で拒否される）。

| やりたいこと | コマンド |
|---|---|
| CI と同じ検証を全部 | `make check` |
| テスト（カバレッジゲート込み） | `make test` |
| テストを 1 ファイルだけ | `make test FILE=library/src/common/base/event.test.ts` |
| ブラウザテスト（Chromium） | `make test-browser` |
| 型検査 / lint / 自動修正 | `make typecheck` / `make lint` / `make fix` |
| ライブラリのビルド | `make build`（`library/dist/`） |
| 依存の追加・更新 | `make pnpm ARGS="add -D <pkg>"` → lockfile もホストに反映される |
| その他の pnpm コマンド | `make pnpm ARGS="exec vitest run --reporter=verbose"` など |
| demo の dev サーバー | `make up`（http://localhost:5173）/ `make logs` / `make down` |
| 初回・Dockerfile 変更後 | `make setup` |
| フィールド用フォントの作り直し | `make font`（`library/src/assets/`） |

- skill や agent の手順が `pnpm run <script>` を指示していたら、上の表の make ターゲットに読み替える
  （例: create-pr の検証ステップは `make check`）
- `node_modules` は Docker volume の中にある。ホストの `library/node_modules/` は空のマウントポイントなので、
  中身を読みたいときは `make pnpm ARGS="exec ls node_modules/<pkg>"` を使う
- pnpm 本体と Node は Dependabot が上げない（Node はイメージだけ上がる）。pnpm は `library/package.json` の
  `packageManager`、Node は `.node-version` と `docker/Dockerfile` を書き換え、イメージに焼き込むので `make setup` する
- playwright は Dependabot が上げるが、ブラウザテストの Chromium はその版に合わせてイメージに焼き込むので、上がったら `make setup` する
- demo をブラウザで確かめる手順は `run-demo` skill にある
- cloud 版の Claude Code では Docker が動かない。SessionStart hook（`docker/cloud-session-setup.sh`）が
  `.node-version` の Node と pnpm、依存を入れて `IN_CONTAINER=1` にするので、make はそのまま使える。
  ただし Docker を操作するホスト専用のターゲット（`setup` `up` `down` `logs` `sh` `clean`）は使えない
