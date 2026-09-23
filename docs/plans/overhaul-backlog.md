<!-- 全体見直し（2026-09）の作業台帳。完了したらこのファイルごと削除する。 -->

# 全体見直し台帳

> **この文書の役割**: 2026-09 に行ったリポジトリ全体の監査結果と、そこから起こす PR の一覧。
> 見直しが終わるまでは、進め方についてはこの台帳が `docs/plans/implementation-roadmap.md` より優先する。
> 8 観点（common / browser・公開 API / 型 / コメント / テスト / バグ / セキュリティ / ツール・文書）の
> 並列監査を統合し、重複を 1 項目にまとめ、must と should は実物のコードで裏を取ってある。
>
## この台帳での進め方

見直しはテーマを 1 つずつ、**毎回ゼロコンテキストの新しいセッション**で進める。
チャット履歴は引き継がない。真実源はこの台帳と merged PR と git 履歴。

セッションを始めたら、次の順で進める。

1. `docs/plans/overhaul-backlog.md`（この文書）と `CLAUDE.md`、`.claude/rules/` を読む。
   設計判断の背景が要るときだけ `docs/prd.md` を読む。
2. 着手するテーマを決める。指定がなければ、**未完了のテーマのうち依存が全部閉じている先頭のもの**を選ぶ。
   完了判定はチャットではなく `gh pr list --state merged` と台帳のチェックで行う。
3. `main` に居ることと、作業ツリーが綺麗なことを確かめて `git pull` する。
4. テーマの項目を上から実装する。判断は「判断」表の結論に従う（`.claude/rules/` の規約が上位）。
   既に決まった論点を蒸し返さない。決め直す必要が出たら、台帳の結論を書き換えてから進める。
5. common の変更はテストを伴う（`src/common/**` は 4 指標 100% ゲート）。
   コマンドは必ず `make` 経由（`make test` / `make typecheck` / `make lint` / `make check`）。
   browser を触ったら `run-demo` skill で画面を目視する。
6. `make check` が緑になったら `/simplify` を無確認で実行する（`.claude/rules/workflow.md`）。
7. 台帳のチェックを埋め、テーマが閉じたら見出しに `(done)` を付ける。この更新も同じ PR に含める。
8. `/create-pr` を実行してよいかユーザーに尋ね、承認を得てから PR を作る。マージはユーザーが行う。

補足:

- 1 テーマ = 1 PR。規模が L のテーマは、テーマ内に書いてある分割案（例: T6a / T6b）で 2 本に割ってよい。
- 実装中に新しい問題を見つけたら、直さずに台帳へ項目を足す（そのテーマの範囲なら直してよい）。
- 公開 API の破壊的変更は歓迎される。利用側アプリはまだ無いので、互換レイヤや非推奨期間は作らない。
- 全テーマが閉じたら、最後の PR でこのファイルを削除する。

## 全体所見

- **common 層**: レイヤ分離、IF 抽出、コマンドパターン、Emitter/Disposable の骨格はできていて、DOM も持ち込んでいない。一方で、id 重複の素通し、通知と履歴更新の順序、ゾーン窓と絶対座標のずれという 3 つの実害バグがある。EditorController（633 行）には責務が集中していて、イベントが 1 本しかない。IPlayModel に軽い読み取り API がないことと、コマンドの定型の繰り返しも、今後の変更を重くしている。
- **browser 層と公開 API**: Model–View 分離と解放は概ね守られている。ただしテーマ既定値が 4 か所にあり、CSS 変数が祖先から上書きできない。規約にある IRenderer は存在しない。mode は固定で、onChange も options でしか受け取れない。Playmaker が Disposable を継承しているため、内部型が d.ts に漏れている。入力には pointercancel、ボタン判定、touch-action がなく、PropertyPanel は確定のたびに DOM を作り直してフォーカスを失う。
- **型**: strict 系の設定、any 0、enum 0、非 null アサーション 0 で土台は良い。ただし tsconfig が 1 本なので、common の DOM 非依存をコンパイラが守らせていない。外部入力の境界の型は unknown と食い違っていて、as で辻褄を合わせている。値リストが二重に定義され、`arr[i] as T` も約 20 箇所ある。
- **テスト**: common は 100% ゲートで広く網羅されている。ただしテスト名とコメントがカバレッジの分岐に引きずられている。1 つの it に複数の振る舞いを詰め込んだものが多く、フェイク注入も使っていない。掴み位置のずれと playmaker.ts の onChange 契約は無テストのまま。
- **コメント**: Why はよく書かれている。一方で冒頭の定型ブロック、記号略記（＝ → 55 行 / 48 行）、ラベルだけの PRD 参照、呼び出し元の名指しが多い。LineKind の JSDoc は実挙動と逆で、件数、窓の寸法、PRD 章番号の古い記述も残っている。
- **セキュリティ**: innerHTML、eval、プロトタイプ汚染の経路はなく、ランタイム依存もゼロ。実質的な指摘は、件数に上限がないことによる描画フリーズ（DoS）と、エクスポート幅に上限がないことだけ。
- **ツールとドキュメント**: Docker と make への一本化は良い。ただし prepare が build を呼ぶため、CI で型検査が 3 回走っている。make check と CI の手順も食い違っている。ロードマップは作業記録になっていて、M9 以降の変更が反映されていない。完了済みのプラン、PR テンプレート、README の API 記述も実物とずれている。

## 判断（2026-09-23 に全件決着）

ユーザーとの対話で 19 件すべてを決めた。以降のテーマはこの結論に従う。

| # | 論点 | 結論 |
|---|---|---|
| D1 | IRenderer | **導入する**。`ILayerRenderer { draw(ctx, frame) }` に揃えて CanvasSurface に注入する（T12） |
| D2 | コメント規約の衝突 | **writing-conventions skill に完全準拠**。コード内の PRD 参照とファイル冒頭の定型ブロックは全廃する。型で表せない契約・失敗時の挙動を書く JSDoc は skill も認めるので残す |
| D3 | docs/plans の運用 | **docs/plans のまま**。実行中の計画だけを置き、完了したら削除する。ルールを CLAUDE.md に 1 行足す |
| D4 | Actions の参照 | **`@main` を継続**（PR #66 の判断を維持）。例外である理由を CI のコメントに明記する |
| D5 | 配布形式 | **ESM のみ**。`main` / `module` / `require` を削除する |
| D6 | erasableSyntaxOnly | **採用**。引数プロパティ約 13 箇所を明示フィールドにし、biome の noParameterProperties も有効にする |
| D7 | readonly 化 | **公開 PlayData まで全部 readonly** にする |
| D8 | 件数上限 | **正規化で切り詰める**（MAX_PLAYERS / MAX_LINES / MAX_WAYPOINTS_PER_LINE） |
| D9 | ゾーンと座標 | **LOS 相対にする**。`field.losYard` を持ち、選手・線は LOS からの相対座標にする（スキーマ v2）。縦軸のキーは `downfieldYard`（正が攻撃方向）。ゾーンを切り替えると LOS をそのゾーンの既定の位置へ移し、図ごと動かす。losYard は今は内部だけで、利用者が直接指定する API は要望が出てから（2026-09-23 に決着） |
| D10 | 線の太さの単位 | **既定幅に対する倍率**（1 = 既定）。v2 migration で入れる |
| D11 | 既定に戻す操作 | **持つ**。パッチ型に `null` = クリアを入れ、パネルに既定ボタンを足す |
| D12 | 公開 API の入力型 | **2 本に分ける**。型付きの `setPlayData(data: PlayData)` と、`restorePlayData(raw: unknown)` |
| D13 | playmaker.ts の検証 | **DOM 非依存のセッションを common に切り出して node でテストする** |
| D14 | view ⬌ edit | **`setMode` を公開**。履歴を保ったまま UI と入力の束だけを付け外しする |
| D15 | 購読 API | **`onDidChange: Event<PlayData>`**（IDisposable を返す）。Event と IDisposable も公開する |
| D16 | dispose 後の呼び出し | **黙って無視**。変更系は no-op、getPlayData は最後の状態を返し、開発時のみ console.warn |
| D17 | 内蔵 UI の配置 | **grid で分離**。canvas と重ねない。マウント先指定オプションは要望が出てから |
| D18 | 選手の形状 | **2 種（circle / square）だけを正とする**。未公開なので旧データの 6 種は引きずらない。型・レンダラ・PRD から triangle / diamond / pentagon / hexagon を削除し、未知の形状は既定へ寄せる正規化だけ残す |
| D19 | 設計文書 | **`docs/design.md` 1 本**にまとめ、roadmap は削除する |

## テーマ

PR 単位で、依存順に並べる。

基本の順序から変えた点は 2 つある。
- must のバグのうち小さく直せるものは、T1 と T2 として先頭に独立させた。ゾーン窓の問題だけは D9 の判断が要るので、T7 に置いた。
- 設計文書（roadmap）の全面書き直しは T18 に回した。「現状の設計」を書く文書なので、リファクタの後に書かないと二度手間になる。T3 では、roadmap に「全体見直し中は台帳が正」と注記するだけにする。

---

### T1 緊急バグ修正（common） (done)

**目的**: 設計変更を待たずに、実害のある編集バグを止める。

- [x] **T1-1 [must] Undo/Redo ボタンの活性状態が 1 手遅れる**
  - locations: library/src/common/commands/command-service.ts:23-26, library/src/common/undoRedo/undo-redo-service.ts:42-59, library/src/common/editing/editor-controller.ts:184, library/src/common/editing/editor-controller.ts:364, library/src/common/editing/editor-controller.ts:374, library/src/common/editing/editor-controller.ts:377, library/src/common/editing/editor-controller.ts:495-501, library/src/browser/ui/toolbar.ts:69, library/src/browser/ui/toolbar.ts:137
  - 問題: `apply(model)` が onDidChange を同期で発火し、その後で `push` している。そのため Toolbar.sync は更新前の canUndo/canRedo を読む。選手のドラッグ後は「元に戻す」が押せず、最初の Undo 後は「やり直す」が押せない。実物で確認済み（pointerUp は execute しか呼ばない）。
  - 対応: 最小の修正として、EditorController の execute/undo/redo の後で fire する。恒久策は T8-1 の履歴イベント。sync が発火の最中に読んでも正しい値になることをテストで確かめる。
- [x] **T1-2 [must] 外部データの選手/線の id 重複を正規化で弾いておらず、別の要素が編集される**
  - locations: library/src/common/model/player.ts:85, library/src/common/model/player.ts:103-115, library/src/common/model/line.ts:119, library/src/common/model/line.ts:143-155, library/src/common/model/line.ts:193, library/src/common/model/play-data.ts:77-88, library/src/common/model/play-model.ts:96-99, library/src/common/model/play-model.ts:177-189, library/src/common/model/play-model.ts:212, library/src/common/geometry/hit-test.ts:25, library/src/common/editing/editor-controller.ts:229, library/src/common/editing/editor-controller.ts:545-556, library/src/common/commands/player-commands.ts:68-73
  - 問題: 明示的な重複 id も、補完値 `p${index}` と明示 id の衝突もそのまま通る。hit-test は末尾の要素を返すが、find/update は先頭の要素に作用するので、上に描かれた選手をドラッグすると下の選手が動く。実物で確認済み。
  - 対応: resolvePlayData で `seen: Set` を使って一意化し、重複は `${base}-2` のように振り直す。線は元 id を持つ先頭の選手に紐付ける。addPlayer/addLine は既存 id なら throw する契約にする。migration のテストに重複ケースを足す。
- [x] **T1-3 [must] 作図ツールで選手をダブルクリックすると、長さ 0 の不可視線が確定する**
  - locations: library/src/common/editing/editor-controller.ts:395, library/src/common/editing/editor-controller.ts:576-597, library/src/browser/input/pointer-input.ts:32
  - 問題: points が空のとき、近接判定の比較先がない。2 回目のクリックで起点の上に点が打たれ、dblclick でそのまま確定する。実物で確認済み。
  - 対応: points が空なら起点選手の位置を直前点とみなして判定する。commitLine では、全長が LINE_POINT_MERGE_RADIUS 以下の線を確定せず破棄する。
- [x] **T1-4 [should] 作図中やドラッグ中に Undo/Redo・ゾーン切替・読込を行うと interaction が残る**
  - locations: library/src/common/editing/editor-controller.ts:253, library/src/common/editing/editor-controller.ts:400, library/src/common/editing/editor-controller.ts:495-501, library/src/browser/ui/toolbar.ts:140
  - 問題: 起点の選手が消えても drawing のまま残り、打った点は黙って捨てられる。
  - 対応: 作図中の Undo は最後の打点を取り消す（点がなければ作図をキャンセルする）。それ以外の場合、undo/redo/setFieldZone/loadFormation の前に cancelInteraction を呼ぶ。
- [x] **T1-5 [should] フィールドの外で離すと、窓外の座標が保存される**
  - locations: library/src/browser/input/pointer-input.ts:19, library/src/common/editing/editor-controller.ts:335, library/src/common/editing/editor-controller.ts:350, library/src/common/editing/editor-controller.ts:598
  - 対応: 確定値とプレビューの両方を、現在のゾーン窓（左右はサイドライン間）に収める純関数 `clampToZoneWindow` に通す。定義域（-10..110）では窓外に置けてしまい症状が消えないため、窓に寄せる形へ結論を改めた。T7 で座標を LOS 相対にするときに合わせて直す。
- [x] **T1-6 [should] 対象が消えた選択でも削除ボタンが押せる**
  - locations: library/src/common/editing/editor-controller.ts:8-10, library/src/common/editing/editor-controller.ts:197-206, library/src/common/editing/editor-controller.ts:424-440, library/src/browser/ui/toolbar.ts:139
  - 対応: getViewState で選択を解決し、実在しなければ null を返す（または `canDelete` を足す）。
- [x] **T1-7 [nit] 値が変わらないパッチでもコマンドが積まれ、空の Undo 段と onChange が出る**
  - locations: library/src/browser/ui/property-panel.ts:160, library/src/common/editing/editor-controller.ts:442, library/src/common/editing/editor-controller.ts:450
  - 対応: パッチを当てても現在値と同じなら何もしない。

- 依存: なし
- 完了条件: 各バグの再現手順をテストにした it が緑になり、make check が通る。
- 規模: M

---

### T2 緊急バグ修正（ポインタ入力） (done)

**目的**: タッチ操作や右クリックでドラッグが外れなくなる問題を止める。

- [x] **T2-1 [must] pointercancel、タッチ、主ボタン以外に対応しておらず、ドラッグが外れない**
  - locations: library/src/browser/input/pointer-input.ts:17-21, library/src/browser/input/pointer-input.ts:25, library/src/browser/input/pointer-input.ts:53-57, library/src/styles.css:57
  - 問題: e.button と isPrimary を見ていない。pointercancel と lostpointercapture を購読しておらず、touch-action もない。実物で確認済み。
  - 対応: pointerdown は `button===0 && isPrimary` のときだけ処理する。pointercancel と lostpointercapture で cancelInteraction を呼ぶ。edit モードの canvas に `touch-action: none` を付ける（view モードでは図の上でもページをスクロールできるよう付けない）。
  - 補足: pointerup の直後にも lostpointercapture が出るので、押下中のポインタ id を控え、up で先に消してから判定する。そうしないと作図の打点ごとに作図が取り消される。作図は押下をまたぐ操作なので、中断で捨てるのはドラッグだけにした。
- [x] **T2-2 [should] ショートカットが canvas にしか効かず、focus でページがスクロールする**
  - locations: library/src/browser/input/pointer-input.ts:18, library/src/browser/input/pointer-input.ts:33-51, library/src/browser/input/pointer-input.ts:57
  - 対応: keydown は root に付け、input/select/textarea から来たものは除外する。focus は `{ preventScroll: true }` で呼ぶ。

- 依存: なし（T1 と並行してよい）
- 完了条件: demo で右クリック、タッチのパン、ツールバー押下直後の Cmd+Z を手で確かめ、壊れないこと（run-demo）。
- 規模: S

---

### T3 規約とドキュメントの整合 (done)

**目的**: 以降の PR が従う基準を先に正す。

- [x] **T3-1 [should] 規約、agent、roadmap が存在しない IRenderer を前提にしている**（D1）
  - locations: .claude/rules/architecture.md:30, .claude/rules/testing.md:27, .claude/rules/testing.md:31, .claude/agents/test-writer.md:16, .claude/agents/test-writer.md:34-35, docs/plans/implementation-roadmap.md:28-29, docs/plans/implementation-roadmap.md:44
  - 対応: D1 が (a) なら「導入予定、T12 で実装」と書き、例は実在する IF にする。(b) なら記述ごと削除する。
- [x] **T3-2 [should] view⇄edit の切替を「提供する」と書いてあるが、実装がない**（D14）
  - locations: .claude/rules/architecture.md:21, docs/plans/implementation-roadmap.md:26
  - 対応: D14 の結論に合わせて書き直す。
- [x] **T3-3 [should] comments.md に不足している規定を足し、skill との衝突を解消する**（D2）
  - locations: .claude/rules/comments.md:16-26
  - 対応: 次を追記する。
    - 公開 API の JSDoc の扱い
    - PRD 参照の基準
    - ファイル冒頭ブロックの基準
    - 文末の「。」
    - 矢印と「＝」でつなぐ略記の禁止（数式と変換方向の短い注記は可）
    - 呼び出し元を名指ししないこと
    - 区切り見出しの禁止
    - カバレッジの数字を Why にしないこと
    - skill の TODO Preference はこのリポジトリでは適用しないこと
    - 見出し記法と em dash の修正
- [x] **T3-4 [nit] testing.md の命名基準が writing-conventions より緩く、test-writer が規約を丸ごと複製している**
  - locations: .claude/rules/testing.md:1-60, .claude/agents/test-writer.md:10-44, .claude/agents/test-writer.md:59
  - 対応: 命名は「入力と結果を書く。メソッド名で始めない」にする。test-support の置き場を 1 行足す。agent は rules を参照させる形にし、例のパスは実在するものにする。
- [x] **T3-5 [should] 完了済みのプラン文書が残り、docs/plans の運用ルールがない**（D3）
  - locations: docs/plans/https-github-com-yamat47-playmaker-pulls-distributed-cocke.md:1, .claude/settings.json:53
  - 対応: cocke.md を削除し、CLAUDE.md に docs/plans の運用ルールを 1 行足す。roadmap の冒頭には「全体見直し中はこの台帳が正」と注記する。
- [x] **T3-6 [should] PR テンプレートが writing-conventions とぶつかっている**
  - locations: .github/pull_request_template.md:3, .github/pull_request_template.md:5-9, .github/pull_request_template.md:15
  - 対応: 背景、やらなかったこと、見てほしいところの 3 節で、日本語で書き直す。

- 依存: D1、D2、D3、D14 の判断
- 完了条件: rules、agent、テンプレートに、実在しない IF と未実装の API の記述がなくなる。make check が通る。
- 規模: S

---

### T4 ツールチェーンと配布 (done)

- [x] **T4-1 [should] prepare が build を呼ぶため、CI で型検査が 3 回走る。check と CI の手順もずれている**
  - locations: library/package.json:27, library/package.json:32, library/package.json:36, .github/workflows/ci.yml:51, .github/workflows/ci.yml:60, Makefile:82
  - 対応: `build` は `vite build` だけにし、`check` を `typecheck && lint && test && build` にする。CI の install では `--ignore-scripts` で prepare を飛ばし、中身は check と揃える。
- [x] **T4-2 [should] CJS 利用者に ESM の型が渡る。使われていない script と重複フィールドもある**（D5）
  - locations: library/package.json:6, library/package.json:11-21, library/package.json:28, library/package.json:35, library/vite.config.ts:31, library/vite.config.ts:36-37
  - 対応: `formats: ["es"]` にし、main、module、require を削除する。exports を types、import、./styles.css、./package.json に絞る。preview と format の script を削除する。
- [x] **T4-3 [should] Dev Container の typescript.tsdk が、tsserver を同梱しない TS 7 を指している**
  - locations: .devcontainer/devcontainer.json:23
  - 対応: tsdk の指定を削除し、Native Preview 拡張と useTsgo を設定する。見直す条件を設計文書に書く。
- [x] **T4-4 [should] toolkit を @main で参照している**（D4）
  - locations: .github/workflows/ci.yml:34, .github/workflows/ci.yml:36, .github/workflows/ci.yml:43, .github/dependabot.yml:3
- [x] **T4-5 [nit] 依存更新の追いかけに穴がある**
  - locations: library/package.json:47, library/pnpm-workspace.yaml:5-6, .github/workflows/ci.yml:46, docker/Dockerfile:4, .github/dependabot.yml:10-30
  - 対応: 不要になった minimumReleaseAgeExclude を削除する。Node のバージョンは `.node-version` に書き、CI は node-version-file で読む。npm に cooldown を付ける。pnpm 本体の更新は依存更新の手順に 1 行足す。
- [x] **T4-6 [nit] FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 を外す条件がない**
  - locations: .github/workflows/ci.yml:14-16
  - 対応: env を削除して CI の緑を確かめる。
- [x] **T4-7 [nit] フォント再生成の手順がホストでの node の直接実行を案内している**
  - locations: library/src/styles.css:12, library/scripts/generate-field-font.mjs:6-7, library/vite.config.ts:9
  - 対応: `make font` ターゲットを追加し、コメントを `make font` と `make up` に書き換える。

- 依存: D4、D5
- 完了条件: CI で型検査が 1 回、build が 1 回になる。attw 相当の確認で型の不整合がない。make check と CI の手順が一致する。
- 規模: S

---

### T5 型と lint の締め付け (done)

- [x] **T5-1 [should] common に DOM lib、@types/node、vitest globals が効いている**
  - locations: library/tsconfig.json:5-7, library/tsconfig.json:25, library/tsconfig.build.json:1, library/vite.config.ts:58, library/biome.json:10-12, library/src/common/event/emitter.ts:23
  - 対応: tsconfig を common（ES2022、types なし）、browser、test、tooling に分け、`tsc -b` で型検査する。vitest/globals と `globals: true` を削除する。biome の overrides で common から browser への import を禁止する。emitter.ts:23 の既定値の console は扱いを決める。
  - 結論: 共通の設定は tsconfig.base.json に置き、tsconfig.json は 4 本を束ねるだけにした。demo は DOM と vite/client を使うので browser に入れた。emitter.ts の console は既定値のまま残し、モジュールの中で `declare const console` に error だけを宣言した。グローバルに宣言すると DOM や @types/node の console とぶつかり、既定値をなくすと common の Emitter すべてにエラー処理を注入することになるため。
- [x] **T5-2 [should] Biome の warn 級ルールが CI を落とさない。Promise と網羅性の検査もない**
  - locations: library/biome.json:15, library/package.json:17
  - 対応: `--error-on-warnings` を付ける。nursery の noFloatingPromises、noMisusedPromises、useExhaustiveSwitchCases を有効にする。useImportType は off にし、理由をコメントに書く。
  - 結論: コメントを書けるよう、設定ファイルを biome.jsonc に改名した。demo の PNG 出力が noMisusedPromises に当たるので、T17-2 もここで片付けた。
- [x] **T5-3 [nit] erasableSyntaxOnly を採るか**（D6）
  - locations: library/tsconfig.json:3, library/src/common/editing/editor-controller.ts:177, library/src/common/commands/command-service.ts:19, library/src/common/undoRedo/undo-redo-service.ts:26, library/src/common/commands/field-commands.ts:12, library/src/common/commands/player-commands.ts:41, library/src/common/commands/player-commands.ts:62, library/src/common/commands/player-commands.ts:91, library/src/common/commands/line-commands.ts:41, library/src/common/commands/line-commands.ts:62, library/src/common/commands/line-commands.ts:104, library/src/common/commands/line-commands.ts:136, library/src/common/geometry/field.ts:154, library/src/common/emitter.ts:23
- [x] **T5-4 [nit] tsconfig の細部**
  - locations: library/tsconfig.json:3-4, library/tsconfig.json:15-18
  - 対応: `module: "preserve"` と `moduleDetection: "force"` にする。esModuleInterop、declaration、sourceMap、outDir を削除する。noPropertyAccessFromIndexSignature は採らず、その判断を T18 の設計文書に残す。
- [x] **T5-5 [should] テスト補助の置き場がなく、共通化するとカバレッジゲートに引っかかる**
  - locations: library/vite.config.ts（coverage.include/exclude）, library/src/common/commands/edit-flow.test.ts:13, library/src/common/commands/formation-commands.test.ts:10, library/src/common/commands/line-commands.test.ts:14, library/src/common/model/play-data.test.ts:12, library/src/common/model/play-model.test.ts:8, library/src/common/formations/formation.test.ts:6, library/src/common/model/line.test.ts:15, library/src/common/geometry/hit-test.test.ts:11, library/src/common/commands/player-commands.test.ts:12
  - 対応: `src/test-support/` に must と fixtures を置き、coverage と build の対象から外す。以降のリファクタで使えるよう、ここで先に入れておく。
  - 規約: `.claude/rules/testing.md` の test-support の行から「T5-5 で作り」を消し、実在する置き場として書き直す。

- 依存: T4、D6
- 完了条件: common で `document` を書くと型エラーになる。warning があると CI が落ちる。make check が通る。
- 規模: M

---

### T6 model の型と正規化の整理 (done)

- [x] **T6-1 [should] 外部入力の境界の型が、実態の unknown と食い違っている**（内部の部分。公開の部分は T14 で D12 に従う）
  - locations: library/src/common/model/play-data.ts:43-45, library/src/common/model/play-data.ts:77, library/src/common/model/migration.ts:81, library/src/common/model/play-model.ts:84-85
  - 対応: resolvePlayData と PlayModel constructor の引数を unknown にし、`as` を消す。
- [x] **T6-2 [should] 値リストが二重に定義され、as const からの型導出になっていない。ガードと位置の解析も重複している**
  - locations: library/src/common/model/line.ts:13, library/src/common/model/line.ts:21, library/src/common/model/line.ts:29-30, library/src/common/model/line.ts:54-80, library/src/common/model/player.ts:9, library/src/common/model/player.ts:14, library/src/common/model/player.ts:52-62, library/src/common/model/player.ts:75-82, library/src/common/model/play-data.ts:13, library/src/common/model/play-data.ts:18, library/src/common/model/play-data.ts:44, library/src/common/formations/formation.ts:11, library/src/common/formations/formation.ts:33-41, library/src/browser/ui/property-panel.ts:19-20, library/src/browser/ui/property-panel.ts:180, library/src/browser/ui/toolbar.ts:16, library/src/browser/ui/toolbar.ts:22, library/src/browser/ui/toolbar.ts:28
  - 対応: `common/model/guards.ts` に isFiniteNumber、isNonEmptyString、`isOneOf`、parseFieldPosition を置く。値リストは `X_VALUES as const` から型を導出する。UI のラベル表は `satisfies Record<…>` で網羅性を検査する。
  - 結論: `as Record<string, unknown>` を消すため、guards.ts に isRecord も置いた。ゾーンの値リストはフィールドの並び（自陣 RZ、中央、相手 RZ）にして、ツールバーがその順で並べる。形状のパネルは 2 種だけを出す部分集合のままにし、D18 で型を 2 種にするときに揃える（T13-3）。
- [x] **T6-3 [should] ドメイン型に readonly がなく、防御的コピーに頼り切っている**（D7）
  - locations: library/src/common/model/player.ts:35, library/src/common/model/player.ts:44, library/src/common/model/line.ts:38, library/src/common/model/play-data.ts:20, library/src/common/model/play-data.ts:34, library/src/common/model/play-model.ts:15, library/src/common/model/play-model.ts:22, library/src/common/editing/editor-controller.ts:65, library/src/common/editing/editor-controller.ts:74, library/src/common/geometry/field.ts:63, library/src/common/geometry/field.ts:130, library/src/common/design/metrics.ts:38, library/src/common/model/migration.ts:19
- [x] **T6-4 [should] IPlayModel に軽い読み取り API がなく、深いコピーを多用している**
  - locations: library/src/common/model/play-model.ts:32-42, library/src/common/model/play-model.ts:226-229, library/src/common/editing/editor-controller.ts:220, library/src/common/editing/editor-controller.ts:360, library/src/common/editing/editor-controller.ts:400, library/src/common/editing/editor-controller.ts:430-452, library/src/common/editing/editor-controller.ts:472, library/src/common/editing/editor-controller.ts:506, library/src/common/editing/editor-controller.ts:585, library/src/common/editing/editor-controller.ts:599, library/src/common/editing/editor-controller.ts:631
  - 対応: `getSnapshot(): DeepReadonly<PlayData>`、hasPlayer、hasLine、getPlayerIds、getLineIds を足す。getData（深いコピー）は公開の境界専用にする。
  - 結論: T6-3 で PlayData そのものを readonly にしたので、getSnapshot は DeepReadonly を使わず PlayData を返す。状態は変更のたびに差し替えるので、コピーせずに返す。Model は内部で複製しなくなり、find、update の戻り値、削除のメメント、onDidChange の値も内部の値をそのまま渡す。深いコピーは getData と、playmaker.ts で onChange に渡す直前だけで行う。hasLine、getPlayerIds、getLineIds は使い道がないか getSnapshot から導けるので足さなかった。コマンドの構築時のコピーは、呼び出し側の入力を受ける境界として残した（T8-2 で整理する）。
- [x] **T6-5 [should] PlayModel が Disposable ではない**
  - locations: library/src/common/model/play-model.ts:32-34, library/src/common/model/play-model.ts:77-79, library/src/playmaker.ts:137-143, library/src/playmaker.ts:178
- [x] **T6-6 [should] 公開プリセットが共有の可変オブジェクトで、plays が formations の内部に依存している**
  - locations: library/src/common/formations/presets.ts:10, library/src/common/formations/presets.ts:262-282, library/src/common/plays/presets.ts:6-7, library/src/common/plays/presets.ts:666-690, library/src/common/plays/play-preset.ts:6, library/src/common/plays/play-preset.ts:25, library/src/common/formations/formation.ts:23, library/src/playmaker.ts:37-44
  - 対応: deepFreeze し、型を DeepReadonly にし、getter は複製を返す。TeamSide と DEFENSE_COLOR は `common/presets/shared.ts` へ移す。
  - 結論: 型は T6-3 で readonly にしたので DeepReadonly は使わない。getter は凍結したプリセットをそのまま返す。型でも実行時でも書き換えられないので、複製しても得るものがない。公開型の FormationSide は TeamSide に改名した。
- [x] **T6-7 [should] 件数に上限がなく、大量の要素で描画がフリーズしうる（DoS）**（D8）
  - locations: library/src/common/model/player.ts:103-115, library/src/common/model/line.ts:143-155, library/src/common/geometry/bezier.ts:80-106, library/src/browser/rendering/canvas-surface.ts:142-169, library/src/browser/rendering/line-renderer.ts:34-97
  - 結論: MAX_PLAYERS = 64、MAX_LINES = 128、MAX_WAYPOINTS_PER_LINE = 32。配列は先頭から上限の個数だけを読み、復元できない要素も読んだ数に入れる（巨大な配列や穴のある配列でも読む量が上限で止まる）。
  - 残り: 上限は外部データの正規化にしか掛かっていない。編集で超えられる経路は T8-5 に回し、公開 API の JSDoc には切り詰めを書いた。

- 依存: T5、D7、D8
- 完了条件: common の境界に `as` がない。値リストが 1 か所で定義されている。内部の読み取りが getSnapshot に寄っている。common 100% を維持する。
- 規模: L。大きければ T6a（T6-1、T6-2、T6-7）と T6b（T6-3〜T6-6）に分ける。
- 進み具合: T6a（T6-1、T6-2、T6-7）と T6b（T6-3〜T6-6）の 2 本で閉じた。

---

### T7 スキーマ v2（ゾーン、太さ、色のクリア） (done)

- [x] **T7-1 [must] ゾーン窓と絶対ヤード座標が噛み合わず、レッドゾーンでフォーメーションを読むと画面外に置かれる**（D9）
  - locations: library/src/common/formations/presets.ts:2, library/src/common/editing/editor-controller.ts:471-493, library/src/common/geometry/field.ts:76-89, library/src/browser/ui/toolbar.ts:57, library/demo/main.ts:410-414
  - 問題: プリセットは LOS≈50 で置かれていて middle の窓（35..65）にしか映らないが、loadFormation は平行移動しない。実物で確認済み。
  - 対応: D9 の結論どおりにする。推奨は B で、`field.losYard` と LOS からの相対座標を v2 migration で入れる。
  - 結論: ゾーンの既定の LOS は中央 50、相手 RZ 85（相手 15 ヤード）、自陣 RZ 10（自陣 10 ヤード）。v1 から v2 への段は、v1 のゾーンの LOS を引いて画面上の位置を変えない。読み込んだ losYard は使わず、ゾーンから決め直す。
- [x] **T7-2 [should] 線の太さが拡大縮小されない px で、画面と PNG で見え方が変わる。パネルの `?? 2` も実際の描画と違う**（D10）
  - locations: library/src/browser/rendering/line-renderer.ts:60, library/src/common/model/line.ts:50-51, library/src/browser/ui/property-panel.ts:76, library/src/common/design/metrics.ts:70
  - 結論: v1 の px は、パネルが未指定の線に表示していた 2 px を倍率 1 として割り戻す。描画側（T12-6）も同じ PR で倍率にした。スキーマと描画がずれた状態を main に残さないため。
- [x] **T7-3 [nit] パッチ型で「既定に戻す」を表現できない**（D11）
  - locations: library/src/common/commands/line-commands.ts:11, library/src/common/commands/line-commands.ts:80, library/src/common/commands/player-commands.ts:10, library/src/common/commands/player-commands.ts:110
- [x] **T7-4 [nit] ゾーン一覧の値とラベルが common にない**
  - locations: library/src/browser/ui/toolbar.ts:28, library/src/playmaker.ts:20-44
  - 対応: common に `FIELD_ZONES` を定義する。
  - 結論: 値は T6-2 の FIELD_ZONE_VALUES、表示名は FIELD_ZONE_LABELS として common に置いた。公開は T14-6。

- 依存: T6、D9、D10、D11
- 完了条件: v1 のデータが v2 に移行するテストが緑になる。どのゾーンでプリセットを読んでも選手が窓内に置かれる。
- 規模: M

---

### T8 コマンドと履歴の再編

- [ ] **T8-1 [should] UndoRedoService と CommandService がどちらも model を持ち、apply の経路が 2 本ある。履歴イベントもない**（T1-1 の恒久策）
  - locations: library/src/common/commands/command-service.ts:16-26, library/src/common/undoRedo/undo-redo-service.ts:11-19, library/src/common/undoRedo/undo-redo-service.ts:26, library/src/common/undoRedo/undo-redo-service.ts:42-59, library/src/common/editing/editor-controller.ts:176-181, library/src/common/editing/editor-controller.ts:495-501
  - 対応: IUndoRedoService は model を持たない純粋なスタックにし、onDidChange を持たせる。ICommandService を execute、undo、redo、canUndo、canRedo の唯一の実行者にする。実行は「先に実行し、成功したらスタックを移す」順にする。clear は削除する。
- [ ] **T8-2 [should] コマンドの定型（apply 未実行の throw と、find→差し替え→previous 保持）が 8 回繰り返されている**
  - locations: library/src/common/commands/field-commands.ts:20-24, library/src/common/commands/line-commands.ts:47-52, library/src/common/commands/line-commands.ts:68-94, library/src/common/commands/line-commands.ts:110-126, library/src/common/commands/line-commands.ts:142-155, library/src/common/commands/player-commands.ts:47-52, library/src/common/commands/player-commands.ts:68-81, library/src/common/commands/player-commands.ts:97-121
  - 対応: `requireApplied` を置く。コマンドは UpdateLine と UpdatePlayer に統合し、SetLineWaypoints、SetLineEnd、MovePlayer は削除する。パッチの適用は `applyLinePatch` と `applyPlayerPatch` の純関数にする。
  - 補足: T7 で null による「既定に戻す」を入れたので、UpdateLine と UpdatePlayer は今、Line と Player のフィールドを 1 つずつ書き写して組み立てている。フィールドを足すとパッチの適用で黙って落ちるので、applyLinePatch と applyPlayerPatch では `...current` を起点にし、「undefined は現状維持、null は消す」の規則を 1 か所にまとめる（EditorController の patchChangesAnything も同じ規則を持つ）。
- [ ] **T8-3 [nit] ディレクトリ名 `undoRedo/` だけがキャメルケース**
  - locations: library/src/common/undoRedo/undo-redo-service.ts:1
  - 対応: commands/ に統合する。
- [ ] **T8-4 [should] removePlayers が途中の未知 id で throw すると、それまでの削除が通知なしで状態に残る**
  - locations: library/src/common/model/play-model.ts（removePlayers と removePlayerCore）
  - 問題: 1 件ずつ state を書き換えてから次の id を探すので、後ろの id が無いと前の削除だけが残る。onDidChange も出ず、コマンドは履歴に積まれないので Undo でも戻せない。T1-2 で addPlayers は先に全件を検証する形に直したが、removePlayers は変更前からこの挙動のまま。
  - 対応: 書き換える前に全 id の実在を確かめる。T8-1 の「コマンドが throw してもスタックが壊れない」テストと合わせて、状態も変わらないことを確かめる。

- [ ] **T8-5 [should] 件数の上限が外部データの正規化にしか掛かっていない**（T6-7 の残り）
  - locations: library/src/common/commands/player-commands.ts（AddPlayerCommand）, library/src/common/commands/formation-commands.ts, library/src/common/commands/line-commands.ts（AddLineCommand、SetLineWaypointsCommand）, library/src/common/editing/editor-controller.ts（loadFormation と作図の確定）, library/src/common/model/play-model.ts（addPlayers、addLine）
  - 問題: 作図での打点、選手の追加、`loadFormation` の繰り返しでは MAX_PLAYERS などを超えられる。超えた図は `getPlayData` から戻したときに黙って切り詰められ、ホストが `loadFormation` を繰り返せば描画の負荷も上限なく増える。公開 API の JSDoc にはこの切り詰めを書いてある。
  - 対応: 上限を PlayModel の不変条件にし、追加系のコマンドは上限で止める（UI のボタンも無効にする）か、今のまま JSDoc の注記で済ませるかを決める。

- 依存: T6、T7
- 完了条件: EditorController が ICommandService だけに依存する。履歴の変化で通知が出る。コマンドが throw してもスタックが壊れないことをテストで確かめる。
- 規模: M

---

### T9 EditorController の分割とイベントの分離

- [ ] **T9-1 [should] ドラッグの掴み位置のずれを検証するテストがない**（先に特性テストとして足す）
  - locations: library/src/common/editing/editor-controller.ts:335, library/src/common/editing/editor-controller.ts:350, library/src/common/editing/editor-controller.ts:520, library/src/common/editing/editor-controller.ts:553, library/src/common/editing/editor-controller.test.ts:276, library/src/common/editing/editor-controller.test.ts:360, library/src/common/editing/editor-controller.test.ts:497
- [ ] **T9-2 [should] 6 つの責務が 1 クラス（633 行）に集中している**
  - locations: library/src/common/editing/editor-controller.ts:58-59, library/src/common/editing/editor-controller.ts:115-148, library/src/common/editing/editor-controller.ts:218-291, library/src/common/editing/editor-controller.ts:315-378, library/src/common/editing/editor-controller.ts:471-493, library/src/common/editing/editor-controller.ts:505-568, library/src/common/editing/editor-controller.ts:611-628
  - 対応: 次のように切り出す。
    - `interaction.ts`: DragTarget と DragInteraction
    - `preview.ts`: composePreview と computeOverlay。戻り値は version を持たない SceneData にする。
    - `hit-test` へ handle の当たり判定を移す
    - `instantiateFormation`
    - IF を IEditorGestures、IEditorActions、IEditorScene に分ける
- [ ] **T9-3 [should] onDidChange 1 本で再描画と UI 同期を兼ねていて、多重発火もある**
  - locations: library/src/common/editing/editor-controller.ts:168-169, library/src/common/editing/editor-controller.ts:184, library/src/common/editing/editor-controller.ts:340, library/src/common/editing/editor-controller.ts:415-419, library/src/common/editing/editor-controller.ts:431-432, library/src/common/editing/editor-controller.ts:490-492, library/src/common/editing/editor-controller.ts:607-608, library/src/playmaker.ts:185-187
  - 対応: onDidChangeScene と onDidChangeViewState（差分があるときだけ発火）に分ける。`batch(fn)` で発火を 1 回にまとめる。
- [ ] **T9-4 [should] Interaction と EditorOverlay の判別共用体が mutable で、ありえない組み合わせも表せる**
  - locations: library/src/common/editing/editor-controller.ts:45, library/src/common/editing/editor-controller.ts:65, library/src/common/editing/editor-controller.ts:116, library/src/common/editing/editor-controller.ts:123, library/src/common/editing/editor-controller.ts:145, library/src/common/editing/editor-controller.ts:271, library/src/common/editing/editor-controller.ts:333-335, library/src/common/editing/editor-controller.ts:578
  - 対応: フィールドを readonly にして差し替えで更新する。drag 系の共通部分は DragBase にする。null は型に含めない。EditorOverlay は `kind` で判別する共用体にする。
- [ ] **T9-5 [should] union の分岐が if の連鎖で、網羅性をコンパイラが見ていない**
  - locations: library/src/common/editing/editor-controller.ts:225, library/src/common/editing/editor-controller.ts:253, library/src/common/editing/editor-controller.ts:315, library/src/common/editing/editor-controller.ts:324, library/src/common/editing/editor-controller.ts:332, library/src/common/geometry/field.ts:77, library/src/browser/rendering/line-renderer.ts:100
- [ ] **T9-6 [should] 索引アクセスの `arr[i] as T` が約 20 箇所ある**
  - locations: library/src/common/geometry/polyline.ts:10-11, library/src/common/geometry/polyline.ts:41-42, library/src/common/geometry/polyline.ts:51, library/src/common/geometry/hit-test.ts:60, library/src/common/geometry/hit-test.ts:65, library/src/common/geometry/bezier.ts:92-97, library/src/common/editing/editor-controller.ts:405, library/src/common/editing/editor-controller.ts:529, library/src/common/editing/editor-controller.ts:622, library/src/browser/rendering/line-renderer.ts:80, library/src/browser/rendering/line-renderer.ts:83, library/src/browser/rendering/line-renderer.ts:120, library/src/browser/rendering/line-renderer.ts:122, library/src/browser/rendering/line-renderer.ts:141, library/src/browser/rendering/line-renderer.ts:168
  - 対応: `segments()` ジェネレータ、`.at(-1)`、`readonly [T, ...T[]]`、hitWaypoint が `{ index, point }` を返す形に書き換える。
- [ ] **T9-7 [nit] 命名とディレクトリの揺れ**
  - locations: library/src/common/event/emitter.ts:1, library/src/common/lifecycle/disposable.ts:1, library/src/common/editing/id-factory.ts:1, library/src/common/geometry/field.ts:107, library/src/common/geometry/field.ts:144, library/src/common/editing/editor-controller.ts:81, library/src/common/editing/editor-controller.ts:150, library/src/common/editing/editor-controller.ts:160, library/src/common/editing/editor-controller.ts:221, library/src/common/editing/editor-controller.ts:615
  - 対応: `base/event.ts` と `base/lifecycle.ts`、`model/id-factory.ts` に移す。改名は yardWindow、isDrawing、isSame*、interaction。displayYardNumber は `number | null` を返す。
- [ ] **T9-8 [nit] fieldWindowAspect が export/ に置かれている**
  - locations: library/src/common/export/image-export.ts:18-20
  - 対応: geometry/field.ts へ移す。

- 依存: T8
- 完了条件: editor-controller.ts が 300 行前後になる。pointerMove で Toolbar と PropertyPanel の同期が走らない。T9-1 のテストが分割の前後で緑のまま。common 100% を維持する。
- 規模: L。大きければ T9a（T9-1、T9-2、T9-4〜T9-6）と T9b（T9-3、T9-7、T9-8）に分ける。

---

### T10 セッションの切り出しと barrel の整理（common）

- [ ] **T10-1 [should] playmaker.ts の公開契約が無テスト**（D13）
  - locations: library/src/playmaker.ts:123, library/src/playmaker.ts:137, library/src/playmaker.ts:174, library/src/playmaker.ts:191
  - 対応: `common/editing/play-session.ts`（document 束）を作る。Model、履歴、CommandService、IdFactory、Controller の組み立て、onChange の中継、作り直し、normalizeFormation の経由をここに置く。「確定ごとに onChange を 1 回だけ呼ぶ」「構築時と setPlayData では呼ばない」「setPlayData で履歴をリセットする」「不正な Formation は no-op」「onChange で受け取った PlayData を書き換えても getPlayData の結果は変わらない」を it にする（最後の 1 つは T6b で Model から playmaker.ts へ移った深いコピーの契約）。
- [ ] **T10-2 [should] barrel が内部関数まで約 70 件出していて、古いマイルストーンのコメントも残っている**
  - locations: library/src/common/index.ts:1-147, library/src/common/index.ts:2
  - 対応: browser と playmaker.ts が使う契約だけに絞る。テストは各モジュールを直接 import する。2 行目は削除する。
- [ ] **T10-3 [should] 使われていないフィールド定数に、描画で使われているかのような説明がある**
  - locations: library/src/common/geometry/field.ts:18, library/src/common/geometry/field.ts:40, library/src/common/geometry/field.ts:46, library/src/common/design/metrics.ts:17
  - 対応: 3 つの定数を削除する。

- 依存: T9、D13、D14
- 完了条件: セッションの契約テストが node で緑になる。barrel が必要最小限になる。
- 規模: M

---

### T11 テーマとトークン（browser）

- [ ] **T11-1 [should] テーマ既定値が 4 か所に分かれて定義され、値が食い違っている**
  - locations: library/src/styles.css:25-45, library/src/browser/rendering/canvas-surface.ts:148, library/src/browser/rendering/canvas-surface.ts:239-257, library/src/common/design/line-palette.ts:14-17, library/src/browser/ui/property-panel.ts:133
  - 問題: 選手の色 input の既定値 #1e3fae が、実際の塗り #2b4c72 と一致しない。
  - 対応: `THEME_TOKENS` を 1 つだけ定義し、全箇所をそこから解決する。線パレットには専用の変数を用意する。
- [ ] **T11-2 [should] CSS 変数を .playmaker-root 自身で宣言しているため祖先からの上書きが届かず、テーマを変えても再描画されない**
  - locations: library/src/styles.css:22-46, library/src/browser/rendering/canvas-surface.ts:262-268, library/src/browser/ui/property-panel.ts:141-145
  - 対応: 使う側で `var(--x, 既定値)` と書く。`refresh()` を追加する（公開は T14）。
- [ ] **T11-3 [nit] CSS 変数の命名がばらばらで、ハードコード色や効いていない CSS も残っている**
  - locations: library/src/styles.css:25-45, library/src/styles.css:100, library/src/styles.css:187, library/src/styles.css:197-201, library/src/browser/rendering/canvas-surface.ts:189, library/src/browser/rendering/canvas-surface.ts:206
- [ ] **T11-4 [nit] common/design/ に CSS の知識（変数名とフォント名）がある**
  - locations: library/src/common/design/line-palette.ts:1-18, library/src/common/design/field-font.ts:1-8
  - 対応: `browser/theme/` へ移す。

- 依存: T10
- 完了条件: 既定値の定義が 1 か所になる。ホストが祖先要素で変数を上書きすると、refresh 後に反映される。
- 規模: M

---

### T12 描画パイプライン（browser）

- [ ] **T12-1 [should] IRenderer がない（規約と実装の衝突）**（D1）
  - locations: library/src/browser/rendering/canvas-surface.ts:30-32, library/src/browser/rendering/canvas-surface.ts:38, library/src/browser/rendering/field-renderer.ts, library/src/browser/rendering/line-renderer.ts:34-41, library/src/browser/rendering/player-renderer.ts:54-60, library/src/browser/input/pointer-input.ts:6-9
  - 規約: `.claude/rules/architecture.md` の「描画の IF はまだない」の行を、導入した `ILayerRenderer` の説明に書き換え、IF の一覧に足す。
- [ ] **T12-2 [should] CanvasSurface の責務が多すぎ、DPR の変化にも追従しない**
  - locations: library/src/browser/rendering/canvas-surface.ts:38-59, library/src/browser/rendering/canvas-surface.ts:53, library/src/browser/rendering/canvas-surface.ts:67-83, library/src/browser/rendering/canvas-surface.ts:101-110, library/src/browser/rendering/canvas-surface.ts:120-140, library/src/browser/rendering/canvas-surface.ts:179-226, library/src/browser/rendering/canvas-surface.ts:232-269
  - 対応: 次のように分ける。
    - overlay の描画は OverlayRenderer にする。
    - PNG 出力は `renderPlayToCanvas` にし、画面描画と共有する。
    - 再描画は rAF で束ねる invalidate にする。
    - DPR は matchMedia の change を監視する。
- [ ] **T12-3 [should] exportToPng がフォントの読み込みを待たず、同期 throw と reject が混在し、幅に上限もない**
  - locations: library/src/browser/rendering/canvas-surface.ts:36, library/src/browser/rendering/canvas-surface.ts:67-83, library/src/browser/rendering/canvas-surface.ts:120-140, library/src/common/export/image-export.ts:39-43, library/src/playmaker.ts:161-163
  - 対応: async にし、`document.fonts.load` を待ち、失敗はすべて reject にする。MAX_EXPORT_WIDTH を設ける。`geometry!:` を外す。fonts は `in` で狭める。
- [ ] **T12-4 [nit] CSS の適用が遅れると、同梱フォントでの再描画が行われない**
  - locations: library/src/browser/rendering/canvas-surface.ts:67-70
  - 対応: loadingdone を購読する。
- [ ] **T12-5 [should] DOM に依存しない描画の計算が browser 層にあり、テストされていない**
  - locations: library/src/browser/rendering/line-renderer.ts:99, library/src/browser/rendering/line-renderer.ts:119, library/src/browser/rendering/line-renderer.ts:141, library/src/browser/rendering/line-renderer.ts:168, library/src/browser/rendering/player-renderer.ts:100, library/src/browser/rendering/canvas-surface.ts:262
  - 対応: `common/geometry/line-decoration.ts`、playerPolygonVertices、変数が空のときのフォールバック規則を common へ移し、node でテストする。
- [x] **T12-6 [should] 太さの倍率を描画に反映する**（T7-2 の描画側。T7 で一緒に対応した）
  - locations: library/src/browser/rendering/line-renderer.ts:60

- 依存: T11、T7、D1
- 完了条件: レンダラが RenderFrame に揃い、注入できる。構築直後に書き出した PNG も同梱フォントで描かれる。DPR を変えても鮮明なまま。
- 規模: L。T12-1 と T12-2 を先に、T12-3〜T12-6 を後に分けてもよい。

---

### T13 入力と内蔵 UI（browser）

- [ ] **T13-1 [should] PropertyPanel が確定のたびに DOM を作り直し、フォーカスを失う**
  - locations: library/src/browser/ui/property-panel.ts:29-31, library/src/browser/ui/property-panel.ts:44-59, library/src/browser/ui/property-panel.ts:103-124, library/src/browser/ui/property-panel.ts:107, library/src/browser/ui/property-panel.ts:117, library/src/browser/ui/toolbar.ts:69, library/src/browser/ui/toolbar.ts:129-142
  - 対応: 選択の kind と id が変わったときだけ作り直し、それ以外は値だけ更新する。JSON キーの比較は削除する。onDidChangeViewState を購読する。
- [ ] **T13-2 [should] 選択肢に英語の enum 値がそのまま表示されている**
  - locations: library/src/browser/ui/property-panel.ts:18-20, library/src/browser/ui/property-panel.ts:172-178
- [ ] **T13-3 [should] 形状を 2 種に確定し、残り 4 種を型・レンダラから削除する**（D18）
  - locations: library/src/browser/ui/property-panel.ts:16-18, library/src/common/model/player.ts:9, library/src/common/model/player.ts:14, library/src/browser/rendering/player-renderer.ts
  - 対応: PlayerShape を circle / square だけにし、多角形描画のコードを消す。未知の形状は既定へ寄せる正規化だけ残す。PRD 5.2 の更新は T18。
  - 補足: 型を 2 種にすれば、旧形状は正規化で既定（circle）へ寄るので、migration の段は要らない（T7 で確かめた）。
- [ ] **T13-4 [should] ツールバーとパネルが canvas に重なり、フィールドを隠す**（D17）
  - locations: library/src/styles.css:67-81, library/src/styles.css:129-142, library/src/playmaker.ts:193-197
- [ ] **T13-5 [should] キー割り当てが browser 層にあり、テストされていない**
  - locations: library/src/browser/input/pointer-input.ts:33-51, library/src/browser/ui/property-panel.ts:23, library/src/browser/ui/property-panel.ts:48, library/src/browser/ui/property-panel.ts:118
  - 対応: `common/input/keymap.ts` の resolveKeyAction、toHexColor、太さ入力の検証を common へ移し、テストする。
- [ ] **T13-6 [nit] 色未指定の選手でカラー入力の初期色がテーマの塗りと合わない。既定に戻す UI もない**
  - locations: library/src/browser/ui/property-panel.ts:133, library/src/styles.css:35
  - 対応: 既定色はテーマの解決値を使う。D11 が A なら既定ボタンを足す。
- [ ] **T13-7 [should] 最後の 1 手を戻すと「元に戻す」が無効になってフォーカスが body に落ち、以降のショートカットが効かない**
  - locations: library/src/browser/ui/toolbar.ts（sync で disabled にする箇所）, library/src/browser/input/pointer-input.ts（keydown を root で受ける箇所）
  - 問題: keydown は root で受けるが、無効化されたボタンからフォーカスが外れると、キーは root の外（body）に届く。T2 の demo 確認で見つけた。
  - 対応: ボタンを無効にする前にフォーカスを持っていたら canvas へ移す。または disabled ではなく aria-disabled にしてフォーカスを保つ。

- 依存: T9、T11、T12、D17、D18
- 完了条件: キーボードだけで連続して編集できる。UI が canvas に重ならない。表示はすべて日本語になる。
- 規模: M

---

### T14 公開 API の再設計

- [ ] **T14-1 [should] Playmaker が Disposable を継承して内部型が d.ts に漏れ、dispose 後の方針も決まっていない**（D16）
  - locations: library/src/playmaker.ts:73, library/src/playmaker.ts:123-129, library/src/playmaker.ts:137-143, library/src/playmaker.ts:161, library/src/playmaker.ts:165-168, library/src/common/lifecycle/disposable.ts:49-63
  - 対応: `implements IDisposable` にし、内部の store は private で持つ。loadFormation は読み込めたかを boolean で返す。
- [ ] **T14-2 [should] mode が構築時に固定されている**（D14）
  - locations: library/src/playmaker.ts:74, library/src/playmaker.ts:86-90, library/src/playmaker.ts:137-143, library/src/playmaker.ts:193-197
  - 対応: document 束（T10 の session）と ui 束に分け、`setMode` と `get mode` を足す。
  - 規約: `.claude/rules/architecture.md` の「view と edit は今は構築時に決めるだけ」の行を、`setMode` の説明に書き換える。
- [ ] **T14-3 [should] onChange が options でしか受け取れない**（D15）
  - locations: library/src/playmaker.ts:63, library/src/playmaker.ts:77, library/src/playmaker.ts:85, library/src/playmaker.ts:191, library/src/playmaker.ts:104-114
  - 対応: options は構築時に値を取り出す。購読 API を公開し、Event と IDisposable の型も export する。
- [ ] **T14-4 [should] initialData を二重に migrate・二重に描画していて、入力の型も実際の契約と合わない**（D12）
  - locations: library/src/playmaker.ts:56, library/src/playmaker.ts:94-100, library/src/playmaker.ts:123, library/src/playmaker.ts:137, library/src/playmaker.ts:174, library/src/browser/rendering/canvas-surface.ts:38-58
  - 補足（T7 で判明）: 公開型 FieldState に losYard が必須で増えたが、読み込み時には使わずゾーンから決め直す。型付きで PlayData を組み立てるホストは、意味のない losYard を渡す必要がある。入力側の型では losYard を省略可能にするか、fieldStateForZone を公開するかを、D12 の setPlayData / restorePlayData の型と一緒に決める。また v1 形式（absoluteYard）のカスタム Formation は版を持たず移行されないので、loadFormation で全選手が捨てられ何も起きない。受け付ける形を公開 API の JSDoc に書くか、Formation にも移行を掛けるかを決める。
- [ ] **T14-5 [nit] 公開オプションの optional に `| undefined` がない**
  - locations: library/src/playmaker.ts:50, library/src/playmaker.ts:56, library/src/playmaker.ts:63, library/src/common/export/image-export.ts:30
- [ ] **T14-6 [nit] FIELD_ZONES、refresh、Event 型の公開と、公開面の過不足の整理**
  - locations: library/src/playmaker.ts:20-44

- 依存: T10〜T13、D12、D14、D15、D16
- 完了条件: dist の d.ts に Disposable_2 などの内部型が出ない。setMode で履歴が残る。購読と解除ができる。構築時の migrate と描画が 1 回ずつになる。
- 規模: M

---

### T15 テストの整備

- [ ] **T15-1 [should] テスト名とコメントがカバレッジの分岐に引きずられている**
  - locations: library/src/common/editing/editor-controller.test.ts:342, library/src/common/editing/editor-controller.test.ts:414, library/src/common/editing/editor-controller.test.ts:599, library/src/common/editing/editor-controller.test.ts:827-839, library/src/common/commands/player-commands.test.ts:119, library/src/common/commands/line-commands.test.ts:106, library/src/common/model/play-model.test.ts:125, library/src/common/model/play-model.test.ts:147, library/src/common/model/play-model.test.ts:169, library/src/common/model/play-model.test.ts:292, library/src/common/geometry/hit-test.test.ts:175, library/src/common/model/migration.test.ts:52
- [ ] **T15-2 [should] 1 つの it に複数の振る舞いを詰め込んでいる**
  - locations: library/src/common/editing/editor-controller.test.ts:141, library/src/common/editing/editor-controller.test.ts:239, library/src/common/editing/editor-controller.test.ts:249, library/src/common/editing/editor-controller.test.ts:301, library/src/common/editing/editor-controller.test.ts:321, library/src/common/editing/editor-controller.test.ts:497, library/src/common/editing/editor-controller.test.ts:649, library/src/common/editing/editor-controller.test.ts:669, library/src/common/editing/editor-controller.test.ts:689, library/src/common/editing/editor-controller.test.ts:731, library/src/common/editing/editor-controller.test.ts:799, library/src/common/commands/line-commands.test.ts:44, library/src/common/commands/line-commands.test.ts:115, library/src/common/commands/player-commands.test.ts:89, library/src/common/commands/player-commands.test.ts:128, library/src/common/model/play-model.test.ts:96, library/src/common/model/play-model.test.ts:272, library/src/common/model/play-model.test.ts:285
- [ ] **T15-3 [should] 「コマンドを出さない」系の検証が間接的で、フェイクの ICommandService を使っていない（常に真になる assert もある）**
  - locations: library/src/common/editing/editor-controller.test.ts:32, library/src/common/editing/editor-controller.test.ts:290, library/src/common/editing/editor-controller.test.ts:383, library/src/common/editing/editor-controller.test.ts:556, library/src/common/editing/editor-controller.test.ts:618-629, library/src/common/editing/editor-controller.test.ts:640, library/src/common/editing/editor-controller.test.ts:699, library/src/common/editing/editor-controller.test.ts:750
- [ ] **T15-4 [should] editor-controller.test.ts（839 行）を機能ごとに分け、Arrange の重複を解消する**
  - locations: library/src/common/editing/editor-controller.test.ts:1, library/src/common/editing/editor-controller.test.ts:4, library/src/common/editing/editor-controller.test.ts:362, library/src/common/editing/editor-controller.test.ts:415, library/src/common/editing/editor-controller.test.ts:498, library/src/common/editing/editor-controller.test.ts:568
- [ ] **T15-5 [should] プリセットの健全性テストが for ループにまとめられ、名前と検証内容もずれている**
  - locations: library/src/common/formations/presets.test.ts:15, library/src/common/formations/presets.test.ts:37, library/src/common/plays/presets.test.ts:9, library/src/common/plays/presets.test.ts:23, library/src/common/plays/presets.test.ts:47, library/src/common/plays/presets.test.ts:62
- [ ] **T15-6 [nit] 実装の係数を写しただけのテスト、弱い定数テスト、何も検証しない型テスト、重複テスト**
  - locations: library/src/common/design/metrics.test.ts:6, library/src/common/design/metrics.test.ts:28, library/src/common/model/player.test.ts:27, library/src/common/geometry/hit-test.test.ts:164, library/src/common/formations/formation.test.ts:90-103, library/src/common/editing/id-factory.test.ts:33
- [ ] **T15-7 [nit] AAA のコメントが一部のテストにしかない**
  - locations: library/src/common/event/emitter.test.ts:70, library/src/common/event/emitter.test.ts:82
  - 対応: コメントを削り、空行で段を区切る書き方に揃える。

- 依存: T5-5、T9、T10（コードの形が固まってから）
- 完了条件: テスト名に実装の分岐名や内部関数名が出てこない。Controller のテストがフェイクの CommandService で検証している。common 100% を維持する。
- 規模: M

---

### T16 コメントの総点検

- [ ] **T16-1 [must] LineKind と LineInterpolation の JSDoc がレンダラの実挙動と食い違う**
  - locations: library/src/common/model/line.ts:3, library/src/common/model/line.ts:8-11, library/src/common/model/line.ts:19, library/src/browser/rendering/line-renderer.ts:2, library/src/browser/rendering/line-renderer.ts:52, library/src/browser/rendering/line-renderer.ts:110, library/src/common/design/metrics.ts:52, library/src/browser/ui/property-panel.ts:72
  - 問題: JSDoc は「block は太め・矢印なし」「motion は破線」「実質 straight」と書くが、実物の block は route と同じ太さで T 字キャップが付き、補間は全種別に効く。実物で確認済み。
  - 対応: JSDoc を実挙動に合わせる。PRD 5.3 の更新は T18 で行う。公開型の JSDoc で利用者が誤読するので、先行して T1 に含めてもよい。
- [ ] **T16-2 [should] 実装過程の残骸と古い記述**
  - locations: library/src/common/model/play-data.ts:60, library/src/common/geometry/field.ts:27, library/src/common/commands/command.ts:8, library/src/common/editing/editor-controller.ts:175, library/src/browser/ui/property-panel.ts:17, library/vite.config.ts:49, library/vite.config.ts:66
  - 対応: 削るか、今の事実を書く文に直す。将来課題は docs/plans へ移す。json-summary は使い道がなければレポーターから外す。
- [ ] **T16-3 [should] PRD の章番号の誤引用と、「往復契約」の出典の揺れ**
  - locations: library/src/playmaker.ts:54, library/src/playmaker.ts:135, library/src/playmaker.ts:148, library/src/styles.css:64, library/src/common/design/field-font.ts:2, library/src/common/formations/formation.ts:9, library/src/common/formations/formation.ts:60, library/src/common/geometry/field.ts:27, library/src/common/export/image-export.ts:7, library/src/common/model/migration.ts:75, library/src/common/model/play-data.ts:32, library/src/common/model/play-data.ts:75
- [ ] **T16-4 [should] 件数や寸法の記述が古い（プリセット数、30 ヤード窓）**
  - locations: library/src/common/plays/presets.ts:1, library/src/common/formations/presets.ts:260, library/src/common/model/play-data.ts:8, library/src/common/geometry/field.ts:136
- [ ] **T16-5 [should] フィールドのライン太さの階層と、「9yd マーク」の語がコードと食い違う**
  - locations: library/src/browser/rendering/field-renderer.ts:36, library/src/browser/rendering/field-renderer.ts:164, library/src/browser/rendering/field-renderer.ts:195, library/src/common/design/metrics.ts:41
- [ ] **T16-6 [should] 冒頭の定型ブロック、層方針の繰り返し、長すぎるブロック**（D2）
  - locations: library/src/common/geometry/field.ts:1, library/src/common/design/metrics.ts:1-3, library/src/common/export/image-export.ts:1-4, library/src/common/design/field-font.ts:1, library/src/common/commands/command.ts:1, library/src/common/model/migration.ts:1, library/src/common/model/migration.ts:22-31, library/src/common/model/migration.ts:50, library/src/common/commands/formation-commands.ts:8, library/src/common/commands/command-service.ts:17, library/src/common/undoRedo/undo-redo-service.ts:25, library/src/common/editing/editor-controller.ts:1, library/src/common/editing/editor-controller.ts:175, library/src/browser/rendering/player-renderer.ts:3, library/src/browser/rendering/line-renderer.ts:1-4, library/src/browser/rendering/field-renderer.ts:1-4, library/src/browser/rendering/canvas-surface.ts:112, library/src/browser/rendering/canvas-surface.ts:151
- [ ] **T16-7 [should] PRD 参照をラベルとして貼っただけの箇所を削る**（D2）
  - locations: library/src/common/commands/player-commands.ts:1, library/src/common/commands/line-commands.ts:1, library/src/common/commands/field-commands.ts:1, library/src/common/model/player.ts:6, library/src/common/editing/editor-controller.ts:109, library/src/browser/rendering/player-renderer.ts:1, library/src/browser/ui/toolbar.ts:1
- [ ] **T16-8 [should] カバレッジの数字を Why として書いている**
  - locations: library/src/common/editing/editor-controller.ts:8, library/src/common/export/image-export.ts:47, library/src/common/undoRedo/undo-redo-service.ts:43, library/src/common/model/migration.ts:29
- [ ] **T16-9 [should] 呼び出し元を名指ししている**
  - locations: library/src/common/formations/formation.ts:8, library/src/common/formations/formation.ts:25, library/src/common/plays/play-preset.ts:10, library/src/common/plays/play-preset.ts:30, library/src/common/plays/presets.ts:663, library/src/common/geometry/field.ts:92, library/src/common/model/line.ts:179, library/src/common/model/line.ts:192, library/src/common/editing/editor-controller.ts:44, library/src/common/editing/editor-controller.ts:73, library/src/common/editing/editor-controller.ts:422, library/src/common/editing/id-factory.ts:6, library/src/common/lifecycle/disposable.ts:20, library/src/browser/rendering/canvas-surface.ts:85
- [ ] **T16-10 [should] 記号略記（＝ 55 行、→ 48 行）で文になっていない**
  - locations: library/src/common/editing/editor-controller.ts:9, library/src/common/editing/editor-controller.ts:491, library/src/common/commands/formation-commands.ts:10, library/src/common/commands/formation-commands.ts:12, library/src/common/commands/player-commands.ts:31, library/src/common/model/migration.ts:36, library/src/common/model/play-model.ts:81, library/src/common/export/image-export.ts:45, library/src/browser/rendering/canvas-surface.ts:94, library/src/browser/rendering/canvas-surface.ts:153, library/src/common/geometry/bezier.ts:38（ほか全体）
- [ ] **T16-11 [nit] 同じ内容のコメントが複数箇所にある**
  - locations: library/src/common/commands/command.ts:3, library/src/common/commands/line-commands.ts:2, library/src/common/commands/player-commands.ts:2, library/src/common/commands/field-commands.ts:15, library/src/common/design/field-font.ts:6, library/src/browser/rendering/field-renderer.ts:49, library/src/browser/rendering/field-renderer.ts:230, library/src/browser/rendering/player-renderer.ts:25, library/src/browser/rendering/player-renderer.ts:46, library/src/browser/rendering/player-renderer.ts:52, library/src/browser/rendering/player-renderer.ts:61, library/src/browser/rendering/line-renderer.ts:32, library/src/common/event/emitter.ts:44
- [ ] **T16-12 [nit] 区切り見出しと、文末の「。」の抜け**
  - locations: library/src/common/editing/editor-controller.ts:187, library/src/common/editing/editor-controller.ts:293, library/src/common/editing/editor-controller.ts:313, library/src/common/editing/editor-controller.ts:422, library/src/common/editing/editor-controller.ts:503, library/vite.config.ts:47, library/vite.config.ts:49, library/vite.config.ts:60, library/vite.config.ts:66, library/vite.config.ts:69, library/vite.config.ts:71, library/scripts/generate-field-font.mjs:2-3, library/scripts/generate-field-font.mjs:7
- [ ] **T16-13 [nit] 誤字、不正確な語、What の言い換え**
  - locations: library/src/common/design/metrics.ts:28, library/src/common/design/metrics.ts:39, library/src/common/model/player.ts:117, library/src/common/editing/editor-controller.ts:218, library/src/common/editing/editor-controller.ts:566, library/src/common/editing/editor-controller.ts:620, library/src/browser/rendering/field-renderer.ts:29, library/src/browser/rendering/field-renderer.ts:67, library/src/playmaker.ts:103, library/src/common/geometry/field.ts:85, library/src/browser/input/pointer-input.ts:31

- 依存: T3、T6〜T14（コードが固まってから一括で行う）
- 完了条件: `grep` で「＝」の略記、「→」、マイルストーン名、「DOM 非依存」の定型が見つからない。PRD 参照が D2 の基準に収まる。
- 規模: M

---

### T17 demo の整備

- [ ] **T17-1 [should] demo が公開 API の手本になっていない**
  - locations: library/demo/main.ts:27, library/demo/main.ts:410-419, library/demo/main.ts:511-523, library/demo/main.ts:534, library/demo/main.ts:579, library/demo/main.ts:598, library/demo/main.ts:602, library/src/playmaker.ts:18, library/vite.config.ts:14-18
  - 対応: フォーメーションの読込は `loadFormation` を使う。モードの切替は `setMode` を使う。空の PlayData の組み立ては 1 関数にまとめ、`as PlayData` をなくす。CSS は `import "playmaker/styles.css"` で明示的に読む。要素の取得は instanceof で確かめる。
- [x] **T17-2 [nit] PNG 出力ハンドラにエラー処理がない**（T5-2 の lint に当たるので T5 で対応した）
  - locations: library/demo/main.ts:550-560, library/demo/main.ts:598
  - 対応: try/catch で包み、失敗を status に表示する。catch は `instanceof Error` で狭める。
- [ ] **T17-3 [nit] 件数のコメントと区切り見出し**
  - locations: library/demo/main.ts:2, library/demo/main.ts:45, library/demo/main.ts:354, library/demo/main.ts:509, library/demo/main.ts:575
  - 対応: main.ts:45 の DEFENSE_COLOR の再定義は、T6-6 で移した共有の定数を使う。

- 依存: T14
- 完了条件: demo が公開 API だけで動き、キャストがない。run-demo で全操作を確かめる。
- 規模: S

---

### T18 README と設計文書

- [ ] **T18-1 [should] ロードマップが作業記録になり、現状のコードと食い違っている**（D19）
  - locations: docs/plans/implementation-roadmap.md:8, docs/plans/implementation-roadmap.md:15, docs/plans/implementation-roadmap.md:34-49, docs/plans/implementation-roadmap.md:131, docs/plans/implementation-roadmap.md:141-145, docs/plans/implementation-roadmap.md:143, docs/plans/implementation-roadmap.md:161, docs/plans/implementation-roadmap.md:316, docs/plans/implementation-roadmap.md:347-361
  - 対応: docs/design.md に、現在の設計をテーマ別に書く。tsconfig の分け方（common は ES2022 の lib だけで型検査する）も書く。却下した案と外す条件は残す（TS 7 の回避策、noPropertyAccessFromIndexSignature、nursery ルール）。CLAUDE.md、rules、README、agents、`library/vite.config.ts:16`（TS 7 の回避策を外す条件の参照）からの参照先を差し替える。PRD 5.2、5.3、6.5 も実装に合わせて更新する。
- [ ] **T18-2 [should] README の公開 API とカスタマイズの説明が実物と合っていない**
  - locations: README.md:56, README.md:67-81, README.md:101, README.md:114-119, library/src/playmaker.ts:19-44, library/src/common/design/field-font.ts:8
  - 対応: 公開 API は T14 の結果に一致させる。プリセットは件数を書かず、取得方法だけ書く。フィールドの文字は同梱フォントに固定であることを書く。変数一覧は THEME_TOKENS と一致させる。上書きは任意の祖先要素でできると書く。

- 依存: T1〜T17
- 完了条件: roadmap が削除され、design.md から現状の設計が読める。README の API 表が export と一致する。この台帳を閉じる。
- 規模: M

## 見送り・落とした指摘

- **security「（参考・問題なし）UI 層・正規化層は健全」**: 欠陥ではなく確認結果の記録なので、項目にしない。今後もフィールドごとに抽出して型ガードする方針は T18 の設計文書に書く。
- **重複として統合したもの**（落としたのではなく 1 項目にまとめた）:

  | 統合した指摘 | 統合先 |
  |---|---|
  | id 重複（arch-common / bugs） | T1-2 |
  | 古い選択（arch-common / bugs） | T1-6 |
  | イベント分離（arch-common / arch-browser） | T9-3 |
  | PropertyPanel の作り直し（arch-browser / bugs） | T13-1 |
  | pointer 入力（arch-browser / bugs） | T2-1、T2-2 |
  | 線の太さ（arch-browser / bugs） | T7-2、T12-6 |
  | exportToPng（arch-browser / types / bugs / security） | T12-3 |
  | テーマ既定色（arch-browser / bugs） | T11-1 |
  | 正規化ガードの重複（arch-common / types） | T6-2 |
  | プリセットの可変性（arch-common / types） | T6-6 |
  | IRenderer（arch-browser / tooling-docs / tests） | T3-1、T12-1 |
  | setMode（arch-browser / tooling-docs） | T14-2 |
  | 入力型 unknown（arch-browser / types / tooling-docs） | T6-1、T14-4 |
  | tsconfig 分割（types / tooling-docs） | T5-1 |
  | ESM のみにする（arch-browser / tooling-docs） | T4-2 |
  | undoRedo/ の改名（arch-common / types） | T8-3 |
  | index.ts:2（arch-common / comments / tooling-docs） | T10-2 |
  | node 直接実行の案内（arch-browser / comments / tooling-docs） | T4-7 |
  | getRenderModel の「純関数」（arch-common / comments） | T9-2、T16-13 |
  | カバレッジ注記（comments / tests） | T15-1、T16-8 |
  | demo の catch キャスト（types / tooling-docs） | T17-1、T17-2 |

- **must と should の実物確認**:
  - 次の must は実物のコードを読み、主張どおりであることを確かめた。T1-1（execute と履歴 push の順序）、T1-2（`p${index}` による補完）、T1-3（points が空のとき比較先がない）、T2-1（button 判定、cancel の購読、touch-action がない）、T7-1（loadFormation が平行移動しない）、T16-1（line.ts の JSDoc と line-renderer の実装）。
  - IRenderer が存在しないこと、prepare が build を呼ぶこと、完了済みのプラン文書が残っていることも確かめた。
  - 誤りとして落とした指摘はない。
