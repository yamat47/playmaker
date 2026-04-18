---
name: create-pr
description: |
  変更ファイルのカバレッジチェック、ローカル CI 実行（並列）、失敗自動修正、論理コミット分割、push、PR 作成までを一括実行する。
  `/git:create-pr` コマンドから呼び出される。全ステップを中断なしで自動実行し、途中でユーザー確認を求めない。
---

# PR 作成ワークフロー

変更の検出から PR 作成まで、全工程を一気通貫で実行する。
途中で停止しない。ユーザーに確認を求めない。最後に PR URL を返す。

## 前提

- devcontainer 内でコマンドを実行する: `./scripts/dcc exec "cd application && ..."`
- パーミッションマッチのため `&&` でコマンドを繋がない（各コマンドは別々の Bash 呼び出し）
- `git --no-pager` は使わない（`Bash(git log:*)` にマッチしなくなる）

## ワークフロー

### Step 1: カバレッジチェック（先に spec の抜けを潰す）

**ローカル CI より前にカバレッジを確認する。** CI の rspec は「通るか」しか見ず、変更行に spec が当たっているかは見ないため、ここで spec の抜けを潰しておく。

#### 1a. 変更ファイルの列挙

```bash
git status --porcelain
```

```bash
git diff --name-only main...HEAD
```

未コミット分（staged / unstaged / untracked）もすべて対象に含める。

#### 1b. カバレッジを確認すべき対象

`application/app/` 配下の以下のファイルが変更・追加されていればチェックする:

- `app/models/**/*.rb`
- `app/controllers/**/*.rb`
- `app/components/**/*.rb`（ViewComponent の Ruby 本体）
- `app/models/concerns/**/*.rb`
- `lib/tasks/**/*.rake`
- その他ビジネスロジックを含む Ruby ファイル

スキップしてよいもの:

- 見た目だけのテンプレート変更（`*.html.erb` の i18n / クラス名調整 など、振る舞いが既存 spec でカバーされているもの）
- `config/locales/*.yml` の翻訳追加
- CSS / JS / 画像などのアセット
- `db/migrate/*.rb`（マイグレーションは spec 不要）
- `docs/**`, `.claude/**`, `README.md` などのドキュメント・スキル定義

#### 1c. 対応する spec の有無を確認

ファイル → spec の慣例:

| 変更ファイル | 対応する spec |
| --- | --- |
| `app/models/foo.rb` | `spec/models/foo_spec.rb` |
| `app/controllers/.../foo_controller.rb` | `spec/requests/.../<action>_spec.rb`（path ごとに分割） |
| `app/components/.../xxx_component.rb` | `spec/components/.../xxx_component_spec.rb` |
| `lib/tasks/foo.rake` | `spec/lib/tasks/foo_spec.rb` |

#### 1d. カバレッジを計測

関連する spec を走らせる:

```bash
./scripts/dcc exec "cd application && bundle exec rspec <spec_paths>"
```

実行後、`coverage/.resultset.json` もしくは `coverage/index.html` を開いて per-file coverage と未カバー行を確認する（simplecov が有効）。

#### 1e. 足りない spec を追加する

- 対応する spec ファイルが**存在しない** → 新規作成する
- spec は存在するが**今回の変更行が未カバー** → 該当シナリオの example を追加する
- 条件分岐・エラーパスを追加した場合は**両方のパス**をカバーする
- 既存 spec の慣習（`type:`, `let`, `sign_in_as` などのヘルパー）に合わせる
- 完全な 100% は目指さない。**新しく追加した分岐・メソッドは必ず触る**を目安にする
- カバレッジ埋めのためだけの無意味な spec は書かない

#### 1f. 合格基準

変更行の振る舞いが 1 つ以上の example から触れられていれば合格。ここを通過したら Step 2 へ進む。

### Step 2: ローカル CI チェック（並列実行 + 自動修正）

**次に CI を実行する。** 失敗があればコミット前に修正し、綺麗な状態でコミットする。

CI の全チェックを `local-ci-runner` サブエージェントで**並列実行**する。
最大 **3 サイクル**まで自動修正を試みる。

#### CI チェック一覧

以下の 10 チェックを並列で実行する:

| # | チェック名 | コマンド | 自動修正 |
|---|-----------|---------|---------|
| 1 | rubocop | `./scripts/dcc exec "cd application && bundle exec rubocop"` | `-a` で自動修正可 |
| 2 | biome | `./scripts/dcc exec "cd application && biome ci ."` | `biome check --write .` で自動修正可 |
| 3 | herb_lint (ERB) | `./scripts/dcc exec "cd application && pnpm run lint:erb"` | `-- --fix` で自動修正可 |
| 4 | herb_lint (tests) | `./scripts/dcc exec "cd application && pnpm run test"` | 自動修正不可 |
| 5 | rspec | `./scripts/dcc exec "cd application && bundle exec rspec"` | 自動修正不可 |
| 6 | brakeman | `./scripts/dcc exec "cd application && bundle exec brakeman"` | 自動修正不可 |
| 7 | bundler_audit | `./scripts/dcc exec "cd application && bundle exec bundler-audit check --update"` | 自動修正不可 |
| 8 | scan_js | `./scripts/dcc exec "cd application && bin/importmap audit"` | 自動修正不可 |
| 9 | css_import_order | `./scripts/dcc exec "cd application && bin/check_css_import_order"` | 自動修正不可 |
| 10 | css_import_existence | `./scripts/dcc exec "cd application && bin/check_css_import_existence"` | 自動修正不可 |

#### 修正サイクル

```
サイクル 1: 全チェック並列実行
  ↓ 失敗あり？
  → 自動修正可能なもの（rubocop -a, biome check --write, erb --fix）を適用
  → 自動修正不可能な失敗はコードを読んで手動修正

サイクル 2: 失敗したチェックのみ再実行
  ↓ まだ失敗？
  → 同上

サイクル 3: 失敗したチェックのみ再実行
  ↓ まだ失敗？
  → 諦めて Step 3 へ進む（残った失敗は PR に記載）
```

サブエージェント呼び出し例:

```json
{
  "description": "Run CI checks in parallel",
  "subagent_type": "local-ci-runner",
  "mode": "bypassPermissions",
  "prompt": "ローカル CI チェックを実行してください。`.claude/agents/local-ci-runner.md` の Step 1 に従い、10 個の Bash tool 呼び出しを 1 レスポンスで（`run_in_background` を立てずに）並列発行してください。結果は同 Step 2 の『CI検証結果サマリー』フォーマットで返してください。"
}
```

> **重要**: `run_in_background: true` を指示しないこと。サブエージェント内では非同期 task の結果を回収する手段がなく、確実にハングする。Claude Code は同一レスポンス内の複数 Bash tool_use を並列で実行し、すべての結果が揃ってから返すので、`run_in_background: false`（デフォルト）で十分。

### Step 3: 既存ブランチ・PR の確認

現在のブランチが `main` でなければ、既にオープンな PR があるか確認する。

```bash
git branch --show-current
```

```bash
gh pr list --state open --head "<current-branch>" --json number,title,url
```

- **main 以外 + オープン PR あり** → そのブランチを使い続ける（Step 4 へ）
- **main 以外 + オープン PR なし** → そのブランチを使い続ける（Step 4 へ）
- **main** → タイムスタンプで新しいブランチを作成:

```bash
date +%Y%m%d-%H%M%S
```

```bash
git switch -c "feature/update-<TIMESTAMP>"
```

ブランチ名は以降のステップで使うので記憶する。

### Step 4: 変更の分析とコミット作成

カバレッジ追加分・CI 修正分を含む全変更をまとめてコミットする。論理グループに分割する。

#### 4a. プランファイルの確認

`docs/plans/` 配下に未追跡・変更ファイルがあれば、必ずコミットに含める。

```bash
git status docs/plans/
```

#### 4b. 論理グループへの分割

全変更を分析し、論理的な単位にグループ化する:

- **グループ化の基準**: 機能単位、ファイル種別（migration / model / controller / view）、スコープ
- **コミット順序**: マイグレーション → モデル → コントローラー → ビュー → テスト → 設定
- 各コミットが単独でビルドを壊さないことを意識する
- プランファイルがあれば専用コミット `docs(plans): ...` を作成

#### 4c. 順次コミット実行

各グループに対して:

```bash
git add <files>
```

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <Japanese subject>

<body: why のみ。非自明な場合だけ書く。自明なら subject のみで OK>
EOF
)"
```

- Conventional Commits フォーマット（prefix は英語、subject/body は日本語）
- subject は能動態（「実装する」not「実装されました」）
- **body は Why のみ**。What は subject と diff で伝わる。ファイル列挙・実装詳細・コミット粒度の説明は書かない
- Why が自明（機械的な置き換え、明白な typo 修正、トラッキング issue に紐づく小さな step）なら body は省略して subject のみでコミットする
- **Claude Code のクレジット表記は付けない**（`🤖 Generated with [Claude Code] ...` や `Co-Authored-By: Claude ...` のトレーラーは一切追加しない）。`.claude/settings.local.json` の `attribution` で無効化済み

### Step 5: Push

```bash
git push -u origin "<BRANCH>"
```

push 失敗時:
- エラー内容を確認し、解決を試みる（upstream が先に進んでいる場合は rebase）
- 解決できなければ中断し、エラーメッセージをユーザーに返す

### Step 6: PR 作成

#### 6a. PR テンプレートの読み込み


Read ツールで `.github/pull_request_template.md` を読む。

#### 6b. コミット情報の収集

```bash
git log main...HEAD --format="%H %s"
```

```bash
git diff --name-status main...HEAD
```

#### 6c. PR タイトル生成

コミットの type と scope から自動生成:

- 全コミットが同一 scope → `feat(admin): 管理画面の機能改善`
- 複数 scope → `feat: 複数の機能改善と修正`
- 単一 type + 複数 scope → `fix: バグ修正`

Conventional Commits 形式、Japanese description。

#### 6d. PR 本文生成

**PR テンプレートの構造は必ず維持する。** `.github/pull_request_template.md` の見出し（背景 / モチベーション、詳細、補足情報、チェックリスト）は**勝手に削らない・増やさない・並び替えない**。各セクションを**簡潔に埋める**ことで冗長さを避ける。

##### 載せるもの

- **背景 / モチベーション**: 関連 issue へのリンク（`Refs #N` / `Fixes #N`）と、issue に書かれていない Why があれば 1〜2 文
- **詳細**: 何を変えたかを 1〜3 文で。トラッキング issue に紐づく機械的な refactor なら 1 文で十分
- **補足情報**: レビュアーが注目すべき判断・トレードオフ・既知の制約・破壊的変更の注意。なければ「特になし」か、セクション自体は残して空に近い状態にする
- **チェックリスト**: テンプレートのチェックボックスをそのまま残す

##### 載せないもの

- diff を見れば分かる実装詳細・追加したファイル一覧・追加したクラス名やメソッドの説明
- コンポーネント仕様や使い方の例（コードを読めば分かる）
- ローカルファイルパスのスクリーンショット（GitHub から閲覧不可）
- CI 結果のコピペ（GitHub Actions のステータスで確認できる）
- 各コミットのサマリ（コミット一覧で確認できる）
- 自明な test plan チェックリスト（機械的な「○○を確認する」の羅列）
- テンプレートの HTML コメント（`<!-- ... -->`）とプレースホルダー文言

##### 書き方

- 日本語、能動態
- 一文ごとに改行（GFM の `<br>`）
- テンプレートの見出し構造は維持しつつ、各セクションの中身は最小限に

##### 最小例（トラッキング issue に紐づく小さな refactor）

```markdown
### 背景 / モチベーション

Refs #735

### 詳細

投稿者向け画面のラベル + 値ペア一覧を ViewComponent 化し、profile 系 3 画面のマークアップを置き換える。

### 補足情報

特になし。

### チェックリスト

- [x] このプルリクエストは単一の変更に関連しています。
- [x] コミットメッセージに変更内容と理由を記載しています。
- [x] バグ修正や機能追加の場合は、テストが追加または更新されています。
```

##### 拡張例（レビュアーに伝える判断がある場合）

```markdown
### 背景 / モチベーション

Fixes #1234

旧 API の v1 を段階的に廃止するため、新しい v2 クライアントに切り替える。

### 詳細

`XxxClient` を v2 に差し替え、feature flag `new_client_enabled` で段階ロールアウトする。

### 補足情報

- retry 挙動を変えた。v1 は 3 回まで冪等だったが v2 は 5xx のみ retry する
- 既存の呼び出し箇所の挙動は feature flag OFF では変わらない

### チェックリスト

- [x] このプルリクエストは単一の変更に関連しています。
- [x] コミットメッセージに変更内容と理由を記載しています。
- [x] バグ修正や機能追加の場合は、テストが追加または更新されています。
```

CI 失敗が残っている場合のみ補足情報セクションに追記（通常グリーンなら書かない）:

```markdown
### ⚠️ CI 未解決の失敗

- [ ] `check_name`: エラー概要
```

#### 6e. PR 作成実行

PR 本文を `.tmp/pr-body.md` に Write ツールで書き出してから:

```bash
gh pr create --base main --head "<BRANCH>" --title "<title>" --body-file .tmp/pr-body.md
```

CI 失敗が残っている場合は `--draft` フラグを追加する。

### Step 7: 結果表示

```bash
gh pr view --web
```

PR URL を出力して完了。
