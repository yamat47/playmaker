---
description: RSpec テスト規約。FactoryBot、Request Spec のスタイル。
paths:
  - "application/spec/**"
---

# テスト規約

## RSpec ベストプラクティス

### パフォーマンス
- レコード取得より`exist`での存在確認を優先

### FactoryBot
- **traitで意図を明確に** — 例: `create(:csv_import_request, :for_amazon_gift_card)`
- **デフォルト値は固定値を使わず、ランダム値を使う**
  - `Faker`、`.sample`、`SecureRandom` 等でランダムにする
  - 特定の値が必要な場合は trait で明示する
  - テスト側で必要な値を明示的に渡す（`create(:factory, attribute: 'value')`）

### テストで関連付けを確認
- 新しい関連付けは必ずテストで検証

### allow_any_instance_ofを避ける
```ruby
# Bad
allow_any_instance_of(Model).to receive(:method)

# Good
instance = Model.new
allow(instance).to receive(:method)
allow(Model).to receive(:new).and_return(instance)
```

### ネストの深さを制限内に収める
- contextを結合して1行にまとめる
- 例: `context 'when validation fails with malformed CSV' do`
- 不要なdescribeの階層を削除

## Request Specs の規約

### ファイル構成
- **パスごとにファイルを分割**（同じコントローラーでも別パスは別ファイル）
- DRY を追求せず、テストの独立性と可読性を優先
- ディレクトリ: `spec/requests/{namespace}/{リソース名}/`
- ファイル名: `{パス識別子}_spec.rb`

```
spec/requests/onecareer/report/reports/
├── index_spec.rb      # GET /reports
├── draft_spec.rb      # GET /reports/draft
├── pending_spec.rb    # GET /reports/pending
└── approved_spec.rb   # GET /reports/approved
```

### パス指定
- **文字列でパスを指定**（url_helpers を使わない）

```ruby
# Good
get '/onecareer/report/reports', headers: headers

# Bad
get onecareer_report_reports_path, headers: headers
```

### RuboCop nested groups への対応
- **`rubocop:disable` を使わない**
- アサーションを `.and` で結合してネストを減らす

```ruby
# Good
it 'returns reports with filter links' do
  get '/onecareer/report/reports', headers: headers

  expect(response).to have_http_status(:ok)
  expect(response.body)
    .to include('タイトル')
    .and include('/onecareer/report/reports/draft')
    .and include('/onecareer/report/reports/pending')
end
```

### テストデータのセットアップ
- 基本的なデータはFactoryBotで作成
- 特定のメソッドをstubする場合は、インスタンスを先に生成してからstub
