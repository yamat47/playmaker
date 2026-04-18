---
name: dhh-rails-patterns
description: DHH/37signals流のRails実装パターン。コード実装時にClaudeが自動的に参照。サービスオブジェクト不使用、RESTfulコントローラー、Concernsによる分割。
user-invocable: false
---

# DHH/37signals Rails パターン

このスキルはClaudeがコード実装時に自動的に参照するバックグラウンドナレッジです。

## 核心原則

> "Vanilla Rails is plenty" — Railsの標準機能を最大限活用し、外部依存を最小化する。

---

## 1. サービスオブジェクト：使用禁止

ビジネスロジックは**モデルメソッド**に配置。複雑になったら**Concerns**で分割。

```ruby
# BAD
CloseCardService.new(card, user: current_user).call

# GOOD
card.close(user: current_user)
```

---

## 2. コントローラー：7アクションのみ

`index`, `show`, `new`, `create`, `edit`, `update`, `destroy`

カスタムアクション → **新しいコントローラー**

```ruby
# BAD
resources :posts do
  member { post :publish }
end

# GOOD
resources :posts do
  resource :publication, only: [:create, :destroy]
end
```

---

## 3. Concerns：ドメイン関心事で分割

```ruby
class Post < ApplicationRecord
  include Taggable      # タグ関連のすべて
  include Publishable   # 公開関連のすべて
  include Trashable     # ゴミ箱関連のすべて
end
```

各Concernに関連付け、スコープ、コールバック、メソッドをまとめる。

---

## 4. 使用しないパターン

| 使わない | 代わりに使う |
|---------|------------|
| Service Objects | モデルメソッド + Concerns |
| Query Objects | スコープ |
| Form Objects | モデル + accepts_nested_attributes |
| Decorator/Presenter | ヘルパーメソッド |

---

## 5. データベース優先

```ruby
# マイグレーション
add_column :posts, :title, :string, null: false, comment: 'タイトル'

# モデル（ユーザー向けエラーメッセージが必要な場合のみ）
validates :title, presence: true
```

---

## 6. テスト

- Request Spec を優先
- `allow_any_instance_of` を避ける
- 統合テストを重視

---

## チェックリスト（実装時に確認）

- [ ] サービスオブジェクト → モデルメソッドへ
- [ ] カスタムアクション → 新しいコントローラーへ
- [ ] boolean状態 → 別レコードを検討
- [ ] コントローラーのビジネスロジック → モデルへ
- [ ] 共通処理 → Concernへ
- [ ] DB制約を設定したか
