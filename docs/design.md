# Playmaker の設計

今のコードがどういう形をしていて、なぜそうしたかを書く。要件は `docs/prd.md`、テストの規約は `.claude/rules/testing.md` にある。
パスは `library/` からの相対で書く。

## 層の分け方

VSCode のレイヤ分離を軽くしたものを使う。下の層は上の層に依存しない。

| 層 | 置き場 | 中身 |
|---|---|---|
| common | `src/common/` | DOM に触れないロジック。データ、座標、編集、コマンド、書き出しの寸法、線の飾りの形 |
| browser | `src/browser/` | Canvas の描画、テーマの読み取り、ポインタとキーの入力、ツールバーとパネル |
| 公開エントリ | `src/playmaker.ts` | 2 つの層を結線する `Playmaker` クラスと、利用者に見せる型と値の再エクスポート |

新しいロジックは、まず common に置けないかを考える。判断を common に寄せるほど、browser は薄い殻で済む。

browser は common の具象ではなくインターフェース（`IPlayModel`、`IEditorController`、`ILayerRenderer` など）に依存し、Model を直接書き換えずにコマンドを通す。依存はコンストラクタの引数で渡し、デコレータやサービスコンテナは持たない。イベントの購読や DOM のリスナは `Disposable` の `_register` で持ち主に登録し、`dispose()` でまとめて解放する。

依存の向きは 2 か所で機械的に守る。

- tsconfig を用途ごとに分け、`tsc -b` でまとめて型検査する。`tsconfig.common.json` は lib が ES2022 だけで types も空なので、common で `document` や `window` を書くと型エラーになる
- `biome.jsonc` の `noRestrictedImports` で、common から browser と `playmaker.ts` への import を拒む。`src/test-support/` は build の対象外なので、本体からの import も拒む

| tsconfig | 対象 | lib と types |
|---|---|---|
| `tsconfig.base.json` | 共通の compilerOptions | ES2022、types なし |
| `tsconfig.common.json` | `src/common`（テストを除く） | base のまま |
| `tsconfig.browser.json` | `src/browser`、`src/playmaker.ts`、`demo` | DOM、vite/client |
| `tsconfig.test.json` | node で動くテストと `src/test-support` | base のまま |
| `tsconfig.browser-test.json` | `*.browser.test.ts` | DOM、vite/client、@vitest/browser-playwright |
| `tsconfig.tooling.json` | `vite.config.ts` | node |
| `tsconfig.build.json` | vite-plugin-dts が型定義を書き出す範囲 | DOM、vite/client |

`tsconfig.json` は build 用を除く 5 本を references で束ねるだけにしている。

common の Emitter はリスナの例外を `console.error` に流す。common には console の型が無いので、`base/event.ts` の中で `declare const console` に error だけを宣言した。グローバルに宣言すると DOM や @types/node の console とぶつかる。既定の出し先をなくす案は、common の Emitter すべてにエラーの出し先を注入することになるので採らなかった。

## データ

### PlayData

`PlayData` は版、フィールド、選手、線の 4 つを持つ。型はすべて readonly で、利用者が受け取った値を書き換えても図には波及しない。

```ts
interface PlayData {
  readonly version: 2;
  readonly field: { readonly zone: FieldZone; readonly losYard: number };
  readonly players: readonly Player[];
  readonly lines: readonly Line[];
}
```

選手と線は配列の順に描き、後ろの要素ほど上に重なる。

- 選手は id、位置、形状、ラベル、省略できる色を持つ。形状は `circle` と `square` の 2 種だけにした。種類が多いと図が散らかるうえ、どちらも外接円で当たり判定ができるので、hit-test を形状で分けずに済む
- 線は id、種別（`route` / `block` / `motion`）、起点の選手の id、waypoint の列、終点、補間（`straight` / `bezier`）、省略できる色と太さを持つ。起点を座標ではなく選手の id で持つので、選手を動かすと線の根元も付いてくる
- 線の太さは、種別ごとの既定の太さに対する倍率で持つ（1 が既定）。px で持つと、描く大きさが変わったときに意味が変わる
- 色と太さを省いた選手と線は、テーマの色と既定の太さで描く。パネルの「既定」ボタンで省いた状態に戻せる

### 座標

フィールドの縦は絶対ヤードで考える。自陣のゴールラインが 0、相手のゴールラインが 100 で、エンドゾーンを含めて -10 から 110 まである。大きいほど攻撃方向で、画面の上になる。

選手と線の位置は、絶対ヤードではなく LOS からの相対で持つ。

- `lateralYard` は左サイドラインからの距離（0 から `FIELD_WIDTH_YARDS`）
- `downfieldYard` は LOS からの距離で、正が攻撃方向、負がバックフィールド

ゾーンを切り替えると、LOS をそのゾーンの既定の位置（`LOS_YARD_BY_ZONE`、中央 50、相手 RZ 85、自陣 RZ 10）へ移す。位置が LOS 相対なので、図は形を保ったまま一緒に動く。絶対座標で持っていたときは、中央で描いた図がレッドゾーンでは窓の外に消えた。

`field.losYard` は保存するデータに入れるが、読み込むときはゾーンから決め直し、渡された値は使わない。保存したデータだけから選手の絶対位置を復元できるように値を持たせている。利用者が LOS を好きな位置に置く API は、要望が出てから考える。

ゾーンの窓は `fieldZoneWindow` が決める。中央は縦 30 ヤード、レッドゾーンはゴールラインから 25 ヤード手前とエンドゾーンまでを映す。レッドゾーンの窓が本来の 20 ヤードより深いのは、20 ヤードラインが窓の端に乗ってヤードの数字が見切れるのを避けるためである。
ドラッグやクリックで置く位置は `clampToZoneWindow` で窓の中に寄せ、見えない場所に選手や点を置かない。

### 外から受け取る値

外から来る値はすべて `unknown` として受け取り、正規化してから中に入れる。入口と契約は次のとおり。

| 入口 | 受け取る型 | 通すもの |
|---|---|---|
| `new Playmaker(container, { initialData })`、`restorePlayData(raw)` | `unknown` | `migratePlayData` |
| `setPlayData(data)` | `PlayDataInput` | `migratePlayData`（型が合っていても id の重複と件数の上限は正規化する） |
| `loadFormation(formation)` | `Formation` | `normalizeFormation` |
| `exportToPng({ width })` | `ImageExportOptions` | `resolveImageExportSize` |

`migratePlayData` は例外を投げない。書かれた版を読み（数でなければ 0 とみなす）、その版より新しい移行の段を順に通し、最後に `resolvePlayData` で形を整える。旧版も、版の無いものも、未来版も、今の版の `PlayData` になる。読めない要素だけを捨て、欠けた値は既定で補う。

- 位置が有限の数でない選手、起点の選手が実在しない線、終点が読めない線は捨てる
- id が無い選手と線には配列の位置から id を補い、重複した id は 2 つ目以降を未使用の id に振り直す
- 選手、線、線 1 本あたりの waypoint は、`MAX_PLAYERS`、`MAX_LINES`、`MAX_WAYPOINTS_PER_LINE` の個数までしか読まない。配列は先頭から上限の個数だけを見て、読めなかった要素も数に入れる。巨大な配列や穴のある配列を渡されても、読む量が上限で止まる

実際の図は選手 22 人、線 20 本ほどなので、上限は壊れたデータや悪意のあるデータで描画が止まらないためのものである。編集でも上限は超えられない（後述）。

スキーマを変えるときは、`CURRENT_PLAY_DATA_VERSION` を 1 上げ、`PLAY_DATA_MIGRATIONS` に 1 つ前の版から変換する段を足し、その段のテストを書く。段は次の版で意味が変わる項目だけを変換すればよく、残りは `resolvePlayData` が整える。v1 から v2 への段は、v1 の絶対ヤードからゾーンの LOS を引いて LOS 相対にし、線の px の太さを 2 px を倍率 1 として割り戻す。

`Formation` は選手の位置を LOS 相対で書く。v1 の絶対ヤードで書いたカスタムの隊形には移行を掛けない。位置が読めない選手は捨て、置ける選手が 1 人もいなければ `loadFormation` が false を返す。

### プリセット

フォーメーション（`FORMATION_PRESETS`）と、線まで描き込んだプレー（`PLAY_PRESETS`）を同梱する。どちらも凍結した値をそのまま返す。型でも実行時でも書き換えられないので、渡すたびに複製しない。

- フォーメーションは `loadFormation` に渡し、今の図に選手を追記する。攻守の隊形を順に重ねられる
- プレーは `data` がそのまま `setPlayData` に渡せる `PlayData` で、名前、攻守、種類、パーソネル、1 行の説明を添えてある。一覧でどう見せるかは使う側が決めるので、色は持たない

## 編集

### PlayModel

`PlayModel`（`IPlayModel`）が図の状態を持つ唯一の場所で、変わるたびに `onDidChange` を 1 回出す。次の不変条件を持ち、破る変更は throw で拒む。

- 選手と線の id は重複しない
- 線の起点は実在する選手を指す。選手を消すと、その選手を起点にする線も一緒に消し、Undo で元の並びまで戻す
- 選手、線、waypoint の数は上限を超えない。件数が増える変更は 1 つの commit に通して、そこで上限を確かめる

状態は変更のたびに差し替えるので、`getSnapshot` はコピーせずに返す。深いコピーを作るのは、外へ渡す `getData` と、利用者に通知する直前だけである。

### コマンドと履歴

編集はすべて `ICommand`（`apply` / `undo`）で表す。選手の追加、削除、更新、線の追加、削除、更新、ゾーンの切替、フォーメーションの読み込みがある。

- `apply` は Model を変えたら true を返す。何も変えない操作は Model に触れずに false を返し、`CommandService` は履歴に積まない。値の変わらないパッチやゾーンの切替で Undo が空振りしない
- 逆操作に要る直前の状態は、`apply` を実行したときに各コマンドが自分で覚える。redo は `apply` をもう一度呼ぶ
- 更新はパッチで渡す。省いたキーは今の値のまま、`null` は省略できるキー（色と太さ）の値を消す。規則は `commands/patch.ts` の 1 か所にある

`UndoRedoService` は直線の履歴で、新しい編集を積むと redo の履歴を捨てる。undo と redo は実行する関数を受け取り、それが戻ってから履歴を積み替えるので、通知を受けた側が見る履歴は常に確定したものになる。

### EditorController

`EditorController`（`IEditorController`）は DOM を知らずに、ツール、選択、ヤード座標でのジェスチャを受け取り、コマンドを組み立てる。browser の入力と UI はここだけを呼ぶ。

- IF は読み取り（`IEditorScene`）、ジェスチャ（`IEditorGestures`）、ボタンやパネルからの操作（`IEditorActions`）に分けてある。ツールバーとパネルはジェスチャを知らない `IEditorUi` を受け取る
- 選択は id の希望で、対象が消えても解除しない。読むときに実在を確かめる
- ドラッグと作図の途中は、コマンドを出さずに `interaction.ts` の状態として持つ。`preview.ts` が確定済みの図に途中の状態を重ねた図とオーバーレイを作り、描画はそれを使う。確定するまで履歴も `onChange` も動かない
- 選手の追加、作図の開始、打点、フォーメーションの読み込みは、上限に達していると何もしない。判定は `editor.ts` の `isToolAvailable` と `canLoadFormation` にまとめ、ツールバーのボタンを押せなくする判定と共有する。フォーメーションは入り切らなければ 1 人も置かない
- 通知は `EditorNotifier` が束ねる。公開の操作はどれも 1 つの batch で包み、Model、履歴、選択、途中の状態が何度変わっても、操作の終わりに `onDidChangeScene` と `onDidChangeViewState` を 1 回ずつ出す。表示状態の通知は値が変わったときだけ出るので、ドラッグ中にツールバーとパネルの同期は走らない

id は `IdFactory` が接頭辞ごとに単調に増やして振る。消した id を使い回さないので、Undo で戻した要素と衝突しない。

ジェスチャの解釈とコマンドの組み立てが同じクラスに残っていて、`editor-controller.ts` は 400 行ほどある。ジェスチャを別のクラスに分けるのは、入力の種類が増えたときに考える。

### PlaySession

`PlaySession` は 1 つの図の部品一式（Model、履歴、controller）を持つ。`setPlayData` は部品を丸ごと作り直して履歴を消し、`onDidReset` を出す。controller を 1 つに保って Model だけを差し替える案は、controller が Model を差し替えられる前提になるので採らなかった。

session は今の controller の `onDidChangeScene` と `onDidChangeViewState` を転送するので、描画は作り直しのあとも購読し直さなくてよい。ツールバー、パネル、ポインタの入力は controller を握っているので、`onDidReset` を受けて付け直す。

`onDidChange` は編集の確定ごとに 1 回、最新の図の深いコピーを渡す。コピーはリスナごとに作り、1 つのリスナが書き換えてもほかのリスナに波及しない。

`PlaySession` と `IEditorController` は公開しない。ジェスチャ単位の API を互換つきで固定する便益が、今の利用者には無い。

## 描画

### 層

`CanvasSurface` は canvas の大きさ、DPR、再描画の時機だけを受け持ち、何を描くかは層に任せる。

- 層は `ILayerRenderer { draw(ctx, frame) }` を実装する。図の層はフィールド、線、選手の順に描き、線を選手の下に敷く
- 図の層は `RenderFrame`（geometry、metrics、図、テーマ）だけを受け取る。オーバーレイ（選択の強調とハンドル）は編集の層だけが `EditorRenderFrame` で受け取るので、図の層がオーバーレイを描くことは型で起こらない
- `draw` をメソッドではなく関数型のプロパティで宣言している。メソッド記法だと引数が双変で比べられ、編集の層を図の層の配列に入れても型エラーにならない
- 再描画は `requestAnimationFrame` で 1 回にまとめる。大きさが変わったときはバッファが消えるので、待たずにすぐ描く
- geometry は状態として持たず、描くときと座標を変換するときに、host の大きさとゾーンからその都度求める

線と選手の形は common で決め、browser はそれを描くだけにしている。曲線は Catmull-Rom をベジェに変えてヤード空間の折れ線にサンプリングし（`sampleLinePath`）、描画と当たり判定が同じ折れ線を使う。矢じり、`block` の T 字、矢じりの手前での切り詰め（`line-decoration.ts`）、選手マーカーの輪郭（`player-marker.ts`）も common にあり、node でテストする。線の種別ごとの描き方は PRD 5.3 にある。

### テーマ

配色と UI のフォントは CSS 変数 `--playmaker-<部位>-<部品>` で上書きできる。

- Canvas に描く色の既定値は `browser/theme/tokens.ts` の `THEME_TOKENS` の 1 か所にだけ書く。描く前に `getComputedStyle` で変数を読み、空か色として読めない値なら既定値にする。読んだ値は `normalizeCssColor` で書き方をそろえ、パネルのスウォッチと比べられるようにする
- ツールバーとパネルの色は CSS だけで決まるので、既定値は `styles.css` の内部用の変数（`--_playmaker-ui-*`）に 1 回だけ書く
- 公開の変数は `.playmaker-root` で宣言しない。宣言すると、利用者が祖先の要素で指定した値を打ち消してしまう
- CSS 変数が変わってもブラウザは知らせてこないので、利用者が `refresh()` を呼んで読み直す

ヤードの数字と選手のラベルは同梱のフォント（`src/assets/`、`make font` で作り直す）に固定し、上書きできない。Canvas の `ctx.font` は CSS の `var()` を解釈しないので、フォントは変数ではなく定数から組み立てる。フォントの名前はホストのページのフォントと重ならないよう、ライブラリ専用にしてある。フォントは `styles.css` の `@font-face` ではなく、JS から `FontFace` で登録する。利用者が CSS を読み込む前に PNG を書き出しても同梱のフォントで描けるようにするためである。woff2 は build で JS に data URI として埋め込むので、利用者はフォントのファイルを置かなくてよい。

### PNG の書き出し

書き出しと画面の描画は、同じ `renderLayers` で図の層を描く。書き出しは編集の層を通さないので、選択の強調、ハンドル、作図の途中の形は入らない。ツールバーとパネルは canvas の外の要素なので、もともと入らない。

- 幅が `MAX_EXPORT_WIDTH` を超えたら、拒まずに切り詰める。上限は、iOS の Safari の canvas の面積の上限にどのゾーンでも収まる値にしてある
- canvas を確保できないとき、PNG にできないとき、dispose したあとは reject する。フォントを読み込めなかったときは reject せず、代わりのフォントで描く

## 入力と内蔵 UI

- `PointerInput` はポインタのボタンを見て主ボタンだけを受け、`pointercancel` で途中の操作を取り消す。edit モードの canvas には `touch-action: none` を付け、ドラッグをページのスクロールに取られないようにする。キーの割り当ては `common/input/keymap.ts` の `resolveKeyAction` が決める。持つショートカットは Undo と Redo、作図を確定する Enter、取り消す Esc だけである
- ツールバーとパネルはバニラ DOM で組む。パネルは表示中の要素の kind と id を覚え、同じ要素のあいだは入力を作り直さずに値だけを書き込むので、入力中のフォーカスが外れない
- 上限に達したときは、選手の追加と作図のボタン、読み込むと上限を超えるフォーメーションの選択肢を押せなくし、理由を title で出す。ボタンは `disabled` ではなく `aria-disabled` にして、フォーカスと Tab 順に残す。押した直後に `disabled` にすると、フォーカスが body に落ちる
- edit モードの root は grid で、ツールバーを図の上、パネルを図の右に置く。canvas は残りの領域の大きさで描き、UI と重ならない。view モードは UI を作らず、stage が root 全体を占める

## 公開 API

利用者が触るのは `Playmaker` クラスと、`playmaker.ts` から再エクスポートする型と値だけである。メンバーの一覧は README にある。

- `setMode` は、図と履歴を持つ `PlaySession` を残したまま、編集 UI とポインタ、キーの入力の束だけを付け外しする。view に切り替えると途中の操作を取り消し、選択の強調を描かない。選択そのものは残すので、edit に戻すと強調も戻る
- 入力の型は 2 本に分けた。永続化した値を形を確かめずに戻す `restorePlayData(raw: unknown)` と、型付きで組み立てた図を渡す `setPlayData(data: PlayDataInput)` である。`PlayDataInput` は `field.losYard` を省略できる。どちらも読み込みで、編集ではないので、履歴を消し、`onDidChange` は出さない
- 変更の購読は `onDidChange: Event<PlayData>` で、戻り値の `IDisposable` を dispose するとやめる。`options.onChange` は構築時にこれへ登録するだけである
- dispose したあとの変更は、例外を投げずに何もしない。`getPlayData` と `fieldZone` は dispose した時点の図を返し、`exportToPng` は Blob を返せないので reject する。開発時だけ `console.warn` で知らせる。開発時かどうかはバンドラが置き換える `process.env.NODE_ENV` で判定し、置き換えずに読み込んだときは本番とみなす
- `Playmaker` は `Disposable` を継承せず、`IDisposable` を実装する。継承すると `_register` などの内部のメンバーが型定義に出る

## 配布

- `library/` を git 依存としてサブディレクトリ指定で入れ、`prepare` でインストール時に `dist/` を作る。ビルド成果物はコミットせず、版は git タグで固定する。npm には公開しない（PRD 8.4）
- 出力は ESM だけにした。利用側はバンドラを通すので CJS は要らず、CJS も出すと require した利用者に ESM 用の型が渡って型と実体がずれる
- CSS は `playmaker/styles.css` として別に読み込む。`sideEffects` は CSS だけを指定する
- 型定義は vite-plugin-dts が書き出し、api-extractor で `dist/playmaker.d.ts` の 1 ファイルに束ねる。起点を `src` に固定するため、build 専用の `tsconfig.build.json` を使う

プライベートレジストリへの移行は、商用ソフトのリポジトリで使い始めるときに考え直す。

## ツールチェーン

### 開発環境と CI

Node と pnpm はホストに入れず、Docker のコンテナの中で動かす。コマンドの入口は `Makefile` で、手順は `CLAUDE.md` にある。cloud 版の Claude Code では、Docker の代わりに SessionStart hook が環境を作る（これも `CLAUDE.md` にある）。

CI（`.github/workflows/ci.yml`）は型検査、lint、テスト、build の `verify` と、Chromium でブラウザテストを動かす `browser-test` の 2 つのジョブを並べる。CI はランナーの上で直接動かす。setup-node の pnpm store のキャッシュが、コンテナでの実行より速いためである。install では `prepare` の build を飛ばし、build を 1 回にしている。

Actions は SHA で固定するのが原則だが、自分で管理している `yamat47/github-toolkit` だけは `@main` を追いかける。上流の action の SHA 固定と Dependabot での更新は toolkit 側で行う。toolkit の main の変更はレビューを通らずに次の CI から入るので、この例外は toolkit を自分で管理しているあいだだけ成り立つ。

### tsconfig

有効にしている検査は `tsconfig.base.json` にある。`module` は bundler が出力するので `preserve` にしている。`erasableSyntaxOnly` に合わせ、Biome の `noParameterProperties` でコンストラクタの引数プロパティも禁じる。

`noPropertyAccessFromIndexSignature` は採らない。インデックスシグネチャの型が出てくるのは、外から来た値を `isRecord` で `Record<string, unknown>` に絞る正規化の境界だけである。そこで読む値は `unknown` で、読んだそばから型ガードに通すので、括弧記法を強いても見つかる誤りが無い。Biome の `useLiteralKeys` も括弧記法をドットに直すよう提案する。境界の外で、値の型を持つインデックスシグネチャを使うようになったら考え直す。

### Biome

lint と format は Biome で行い、`recommended` に `--error-on-warnings` を付けて warning でも CI を落とす。

- `useImportType` は切っている。型だけを使う import に `type` が無いことは tsc が `verbatimModuleSyntax` で見つけるので、同じ指摘が 2 か所から出る
- Promise の扱いと switch の網羅性の検査は、typescript-eslint を足さずに Biome の nursery の `noFloatingPromises`、`noMisusedPromises`、`useExhaustiveSwitchCases` で行う。lint の道具を 1 つに保つためである。nursery のルールは Biome の更新で名前や挙動が変わりうる。安定版のグループへ移ったら設定をそちらへ移す。誤検知や見落としで使えなくなったら、typescript-eslint の type-aware なルールに切り替える

### TypeScript 7 の回避策

TypeScript 7.0 はネイティブ実装になり、`typescript` パッケージが JS API（`ts.createProgram` など）と `lib.*.d.ts` を同梱しなくなった。型検査（`tsc -b`）は TS 7 で動くが、型定義の生成は JS API が要る。

- vite-plugin-dts（unplugin-dts）は、`typescript` に JS API が無ければ、TypeScript 公式の互換パッケージ `@typescript/typescript6` から読む。そのため `@typescript/typescript6` を devDependencies に置く
- api-extractor で型定義を束ねるとき、unplugin-dts は `typescript` パッケージの場所を lib の置き場として渡す。TS 7 には `lib.*.d.ts` が無く `Omit` などを解決できないので、`vite.config.ts` の `bundleTypes.invokeOptions.typescriptCompilerFolder` で `@typescript/old`（`@typescript/typescript6` が依存する typescript@6）に向ける

却下した案は 2 つある。pnpm の overrides で unplugin-dts の `typescript` を 6 に差し替える案は、互換パッケージと回避策は消えるが、回避策が pnpm の設定に隠れて見つけにくい。TS 7.0 の告知にある npm alias（`typescript` を `@typescript/typescript6` にする）は、`typescript` の名前が型検査に使う TS 7 と食い違ううえ、互換パッケージにも `lib.*.d.ts` が無いので同じ回避策が要る。

unplugin-dts が TS 7.1 以降の API に対応し、`typescript` パッケージだけで型定義の生成と束ねができるようになったら、`typescriptCompilerFolder` の指定と `@typescript/typescript6` を外す。

エディタの型検査も同じ理由で変えている。TS 7 の `typescript` パッケージは tsserver を同梱しないので、Dev Container では `TypeScriptTeam.native-preview` 拡張を入れ、`typescript.experimental.useTsgo` で tsgo を使う。VS Code の組み込みの TypeScript 拡張が TS 7 の言語サーバーを標準で使うようになったら、拡張と `useTsgo` の指定を外す。

## テスト

置き場、書き方、カバレッジのゲートは `.claude/rules/testing.md` にある。編集の振る舞いは `PlaySession` と `IEditorController` を境界にした仕様テストで確かめるので、内部の分け方を変えてもテストを書き換えずに済む。判断を common に寄せるのは、このテストとカバレッジのゲートを DOM なしで回すためでもある。

## 持たないもの

PRD 4.1 のとおり、組み込みやすさを先に取り、表現の豊かさは絞っている。次のものは意図して持たない。

- 戦術の記法に合わせた見た目の作り込み（波線のモーション、ルートの種類ごとの矢じり）。見た目の最終調整は、商用ソフトで使ってみてから再開する
- waypoint を 1 つずつ足したり消したりする操作。線を描き直せば同じ形になる
- UI フレームワーク、外部の描画ライブラリ、Shadow DOM、DI コンテナ。依存は手動のコンストラクタ注入だけにしている
- LOS の描画、ズームとパン、複数選択、コピーと貼り付け（PRD 8.1）
