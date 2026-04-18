---
name: new-component
description: |
  ViewComponent を新規作成するスキャフォールド兼実装ガイド。admin / report 両スコープに対応。
  Ruby クラス、ERB テンプレート、CSS、Lookbook プレビューの4ファイルを一括生成し、
  `oc-{scope}.css` への CSS インポートも追加する。
  TRIGGER when:
  - 新しい ViewComponent（`app/components/onecareer/{admin|report}/...`）を作成するとき
  - 既存の ViewComponent の CSS / ERB / プレビューを編集・追加するとき
  - ユーザーが「コンポーネントを作りたい」「新しい UI パーツを追加したい」と言ったとき
  - `/new-component admin ui/tooltip` のように明示的に呼び出されたとき
  SKIP when: ViewComponent 以外のビュー（通常の `app/views/` 配下のテンプレート）だけを編集するとき。
argument-hint: "[scope] [layer/name]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
---

# ViewComponent スキャフォールド

`admin`（管理画面）または `report`（投稿者向け画面）スコープの ViewComponent を新規作成する。

## 引数の解釈

`$ARGUMENTS` を空白で分割し、以下のルールで `scope` / `layer` / `name` を決定する。

| 呼び出し例 | scope | layer | name |
| --- | --- | --- | --- |
| `/new-component admin ui/tooltip` | `admin` | `ui` | `tooltip` |
| `/new-component report ui/avatar_with_label` | `report` | `ui` | `avatar_with_label` |
| `/new-component report composite/profile_card` | `report` | `composite` | `profile_card` |
| `/new-component ui/tooltip` | `admin`（デフォルト） | `ui` | `tooltip` |
| `/new-component tooltip` | `admin`（デフォルト） | `ui`（デフォルト） | `tooltip` |

- `scope` は `admin` または `report`。省略時は **後方互換のため admin** をデフォルトにする。
- `layer` は `ui` または `composite`。省略時は `ui`。
- `name` はスネークケース（ハイフンはアンダースコアに変換する）。

## 生成するファイル

以下の4ファイルを生成する。すべてのパスは `application/` 配下。

### 1. Ruby クラス

`app/components/onecareer/{scope}/{layer}/{name}/{name}_component.rb`

```ruby
# frozen_string_literal: true

module Onecareer
  module {Scope}   # Admin または Report
    module {Layer}
      module {Name}
        # {コンポーネントの説明}
        class {Name}Component < ViewComponent::Base
          def initialize(...)
            super()
            # ...
          end

          private

          def css_classes
            "vc-oc-{scope}-{name}"
          end
        end
      end
    end
  end
end
```

注意点:
- `super()` を必ず呼ぶ
- `content` はパラメータ名に使えない（ViewComponent の予約メソッド）。代わりに `body` を使う
- RuboCop の `Style/Documentation` 対応で、クラスに doc コメントが必要
- パラメータが6つ以上になる場合は `rubocop:disable Metrics/ParameterLists` で囲む

### 2. ERB テンプレート

`app/components/onecareer/{scope}/{layer}/{name}/{name}_component.html.erb`

- Rails ヘルパーを呼ぶときは `helpers.` 経由（例: `helpers.icon`, `helpers.simple_format`）
- 他のコンポーネントを render するときはフルパスで指定:
  `<%= render Onecareer::Admin::Ui::Icon::IconComponent.new(name: "check-circle") %>`

### 3. CSS

`app/components/onecareer/{scope}/{layer}/{name}/{name}_component.css`

- プレフィックス: `vc-oc-{scope}-{name}`
- BEM ライク: `vc-oc-{scope}-{name}__{element}`
- バリアント: `is-{variant}` 修飾子
- 既存の CSS 変数（`var(--color-blue-900)` 等）は使ってよい
  - admin: `app/assets/stylesheets/oc-admin/variables/` 配下
  - report: `app/assets/stylesheets/oc-report/variables/` 配下（`colors.css`, `space.css`, `zindex.css`）
- 既存の CSS クラス名（`oc-admin-button`, `oc-report-form-text_field` 等）は参照しない

#### 要素間の余白は flex の `gap` で作る

**原則: コンテンツ要素の間隔は `margin` ではなく、親要素に `display: flex; flex-direction: column; gap: ...` を置く。**

```css
/* Good — 親の gap で間隔を作る */
.vc-oc-report-legal-document {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Bad — 子の margin で間隔を作る */
.vc-oc-report-legal-document > * {
  margin-bottom: 2rem;
}
.vc-oc-report-legal-document > *:last-child {
  margin-bottom: 0;
}
```

理由:
- ReActionView のデバッグモードで `display: contents` のラッパー（`<span data-herb-debug-...>`）が挟まると、`:last-child` / `:first-child` / `+`（隣接兄弟）が期待通りに動かない（CLAUDE.md 参照）
- `margin-bottom + :last-child で 0 に戻す`パターンは冗長で壊れやすい

例外（`margin: 0` としてのリセットは OK）:
- ブラウザデフォルトの `ol` / `ul` / `p` / `h*` の margin を消すための `margin: 0`
- 個別要素の padding と勘違いしやすいがあくまでリセットなので許容
- 横並び `flex-direction: row` で `gap` を使う場合も同様

`ol` / `ul` に `display: flex` を適用してもマーカー（`list-style-type`）はそのまま表示されるので、リスト系コンポーネントでも問題なく使える。
**ただし `li` に直接 `display: flex` を当ててはいけない。** フレックスアイテム化されると `li` のデフォルトである `display: list-item` が上書きされ、`1.` `2.` などのマーカーが消える。`li` の子要素の間隔を gap で取りたい場合は、`li` の中にラッパー `div` を置いて、その div に `display: flex` を付ける。

```erb
<%# Good — li は list-item のまま、内側の div で flex %>
<li class="vc-oc-report-example__item">
  <div class="vc-oc-report-example__item-body">
    <div>テキスト</div>
    <ul class="vc-oc-report-example__sub-list">...</ul>
  </div>
</li>
```

```erb
<%# Bad — li に flex を当てるとマーカーが消える %>
<li class="vc-oc-report-example__item">
  テキスト
  <ul>...</ul>
</li>
```
```css
.vc-oc-report-example__item { display: flex; } /* ← マーカーが消える */
```

### 4. Lookbook プレビュー

`test/components/previews/onecareer/{scope}/{layer}/{name}/{name}_component_preview.rb`

```ruby
# frozen_string_literal: true

module Onecareer
  module {Scope}
    module {Layer}
      module {Name}
        class {Name}ComponentPreview < Lookbook::Preview
          # デフォルト
          def default
            render Onecareer::{Scope}::{Layer}::{Name}::{Name}Component.new(...)
          end
        end
      end
    end
  end
end
```

- render 時は必ずフルパスで指定する（定数解決の問題回避）
- 各バリアントごとにメソッドを作る
- **プレビュー内で `helpers` は使用できない**（`undefined local variable or method 'helpers'` エラーになる）。`link_to` や `safe_join` 等の Rails ヘルパーが必要な場合は `render_with_template` で ERB テンプレートに切り出す:

```ruby
def with_link
  render_with_template
end
```

```
# テンプレートファイル: {name}_component_preview/with_link.html.erb
<%= render Onecareer::{Scope}::Ui::{Name}::{Name}Component.new(...) do %>
  <%= link_to '...', '#' %>
<% end %>
```

## CSS インポートの追加

`application/app/assets/stylesheets/oc-{scope}.css` の `/* ViewComponent */` セクションに追加:

```css
@import url("onecareer/{scope}/{layer}/{name}/{name}_component.css");
```

**ルール:**
- 同じレイヤー（`composite` / `ui`）内はアルファベット順で、**空行を入れずに** 連続して並べる
- 異なるレイヤー間は **空行1行** で区切る（`composite` → `ui` の順）

## 生成後の確認事項

ファイルを生成したら以下を確認する:

1. `.claude/rules/view-components.md` の規約に沿っているか
2. コンポーネントの用途にあったパラメータ設計になっているか（ユーザーに確認）

## 既存コンポーネントの参考

既存の実装パターンを参考にする場合は以下を読む:

### admin スコープ

- ui の例: `app/components/onecareer/admin/ui/badge/`（シンプルなコンポーネント）
- ui + アイコンの例: `app/components/onecareer/admin/ui/button/`（Icon コンポーネントを内部で使う）
- composite の例: `app/components/onecareer/admin/composite/alert/`（複数の ui を組み合わせる）

### report スコープ

現状 ui レイヤーのみ存在（composite はまだ無し）。

- ui のシンプル例: `app/components/onecareer/report/ui/avatar/`
- ui + 内部ロジックの例: `app/components/onecareer/report/ui/app_header/`
- テーブル系: `app/components/onecareer/report/ui/data_table/`, `app/components/onecareer/report/ui/index_list/`
