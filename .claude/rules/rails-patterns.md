---
description: DHH/37signals 流の Rails 実装パターン。サービスオブジェクト不使用、Concerns、preload、DB 設計、Mailer。
paths:
  - "application/app/**/*.rb"
  - "application/config/**/*.rb"
  - "application/db/**"
---

# Rails 実装パターン

## DHH/37signals Rails パターン

このプロジェクトはDHH（David Heinemeier Hansson）と37signals（Basecamp、HEY）が実践する「Vanilla Rails」アーキテクチャに従います。

### 核心原則

> "Vanilla Rails is plenty" — Railsの標準機能を最大限活用し、外部依存を最小化する。

### 1. サービスオブジェクトは使用しない

ビジネスロジックは**モデルメソッド**に配置し、複雑になったら**Concerns**で分割します。

```ruby
# BAD: サービスオブジェクト
CloseCardService.new(card, user: current_user).call

# GOOD: モデルメソッド
card.close(user: current_user)
```

### 2. コントローラーは7アクションのみ

`index`, `show`, `new`, `create`, `edit`, `update`, `destroy` のみ使用。
カスタムアクションが必要な場合は**新しいコントローラーを作成**します。

```ruby
# BAD: カスタムアクション
resources :posts do
  member do
    post :publish
  end
end

# GOOD: 新しいリソース
resources :posts do
  resource :publication, only: [:create, :destroy]
end
```

### 3. Concernsはドメイン関心事で分割

技術的関心事（全バリデーション等）ではなく、**ドメインの関心事**で分割します。

```ruby
class Post < ApplicationRecord
  include Taggable      # タグ関連のすべて
  include Publishable   # 公開関連のすべて
  include Trashable     # ゴミ箱関連のすべて
end
```

各Concernには関連付け、スコープ、コールバック、メソッドをまとめて配置します。

### 4. 使用しないパターン

| 使わない | 代わりに使う |
|---------|------------|
| Service Objects | モデルメソッド + Concerns |
| Query Objects | スコープ |
| Form Objects | モデル + accepts_nested_attributes |
| Decorator/Presenter | ヘルパーメソッド |

詳細は `docs/dhh-37signals-rails-style-guide.md` を参照してください。

## Implementation Best Practices

### Delegated Types Pattern
- このプロジェクトではDelegated Typesパターンを活用
- `CsvImport::Request`のような基底モデルから具体的な実装（`AmazonGiftCard::CsvImport::Request`）へ委譲
- 関連付けを理解してから実装を進めること

### Eager Loading
- **`includes` ではなく `preload` を使う**
  - `includes` は条件によって `preload`（別クエリ）と `eager_load`（LEFT JOIN）を自動切り替えするため、挙動がわかりづらい
  - `preload` は常に別クエリで関連を読み込むため、動作が明示的で予測しやすい
  ```ruby
  # Bad
  SummarizedGroup.includes(:company, groups: :job_category)

  # Good
  SummarizedGroup.preload(:company, groups: :job_category)
  ```

### Database Design
- **既存データとの互換性を考慮** — 外部キーは`null: true`で追加
- **日本語コメントを含める** — マイグレーションには必ず`comment:`を追加
- **データマイグレーションは `db/migrate` で行わない** — 環境ごとにデータ構造が異なるため、`db/migrate` にはスキーマ変更のみ配置する。既存データの変換・バックフィルはデプロイ手順やタスクで別途対応する

### Mailer
- **メーラーメソッドを追加・変更したら、プレビューも必ず作成・更新する**
  - プレビュークラス: `spec/mailers/previews/` 配下
  - 確認URL: `/rails/mailers/{メーラー名}/{メソッド名}`
- **HTML（`.html.erb`）と Text（`.text.erb`）の両形式のテンプレートを作成する**
- **I18n キーは `{namespace}.{mailer_name}.{method_name}.*` の規約に従う**

### Code Comments
- **やっていることをそのまま表すコメントは書かない** — コードを読めば分かることは書かない
- **コメントを書くべき場合** — Why が自明でない場合、複雑なビジネスロジックの背景、外部APIの制約への警告

