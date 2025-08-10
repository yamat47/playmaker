# リファクタリング実施計画

## 実施順序の推奨

### 🎯 **ステップ1: 型定義の統一（所要時間: 2-3時間）**

**理由**: 他のすべての変更の基盤となるため最初に実施

```typescript
// 1. types/index.ts を作成
// 2. Field.tsxからexportしている型を移動
// 3. App.tsx内の重複定義を削除
// 4. 全ファイルでimportを更新
```

**リスク**: 最小（型の移動のみ）  
**効果**: 即座に型の一貫性が向上

### 🎯 **ステップ2: Zustandストアの導入（所要時間: 4-6時間）**

**理由**: 状態管理を整理しないと、コンポーネント分割時に props drilling地獄になる

```typescript
// 1. 選択状態の管理から始める（最も複雑な部分）
// 2. players, linesの管理を移行
// 3. ツール状態、描画状態を順次移行
```

**リスク**: 中（状態の移行時にバグの可能性）  
**効果**: 状態管理の見通しが劇的に改善

### 🎯 **ステップ3: App.tsxの段階的分割（所要時間: 6-8時間）**

**理由**: Zustand導入後なら、プロップスの受け渡しを最小限にできる

```typescript
// 1. PropertyPanel を切り出し（独立性が高い）
// 2. LeftToolbar を切り出し
// 3. Header を切り出し
// 4. 削除ロジックなどをカスタムフックへ
```

**リスク**: 小（UIの切り出しは比較的安全）  
**効果**: App.tsxが300行程度まで削減可能

### 🎯 **ステップ4: Field.tsxのヘルパー関数外出し（所要時間: 3-4時間）**

**理由**: 描画ロジック分離の前準備として必要

```typescript
// 1. utils/geometry.ts（距離計算など）
// 2. utils/canvas/helpers.ts（セグメント操作など）
// 3. 定数をconstants/field.tsへ
```

**リスク**: 最小（純粋関数の移動）  
**効果**: Field.tsxが1000行程度に削減

### 🎯 **ステップ5: Canvas描画ロジックの分離（所要時間: 8-10時間）**

**理由**: 最も複雑だが、他の部分が整理済みなら取り組みやすい

```typescript
// 1. FieldRenderer クラスの作成
// 2. 描画メソッドを段階的に移行
// 3. イベントハンドラーの分離
```

**リスク**: 高（描画の不具合が起きやすい）  
**効果**: テスタビリティが大幅に向上

### 🎯 **ステップ6: テストの追加（所要時間: 6-8時間）**

**理由**: リファクタリング後の動作保証

```typescript
// 1. Zustandストアのテスト
// 2. ヘルパー関数のユニットテスト
// 3. 統合テストの追加
```

## 実施時の注意点

### ✅ **各ステップ完了時のチェックリスト**

```bash
# 必ず実行
pnpm run typecheck
pnpm run lint
pnpm run test --run
pnpm run build

# 動作確認項目
- [ ] プレイヤーの追加・移動
- [ ] ルート描画（3種類のライン）
- [ ] 選択・削除機能
- [ ] プロパティパネルの動作
- [ ] エクスポート機能
```

### 🔄 **段階的マイグレーション戦略**

#### 1. **並行稼働期間を設ける**

- 新旧コードを一時的に共存させる
- 動作確認後に旧コードを削除

#### 2. **機能フラグの活用**

```typescript
// config/features.ts
export const FEATURES = {
  USE_NEW_STATE_MANAGEMENT: false,
  USE_NEW_CANVAS_RENDERER: false,
  USE_SEPARATED_COMPONENTS: false,
};
```

#### 3. **コミット単位を小さく**

- 1機能 = 1コミット
- ロールバックしやすい粒度
- 意味のあるコミットメッセージ

### 📊 **進捗の可視化**

```markdown
## リファクタリング進捗

- [ ] 型定義の統一
  - [ ] types/index.ts作成
  - [ ] 型の移行
  - [ ] import更新
- [ ] Zustandストア
  - [ ] 選択状態の管理
  - [ ] プレイヤー・ライン管理
  - [ ] ツール状態管理
- [ ] App.tsx分割
  - [ ] PropertyPanel分離
  - [ ] LeftToolbar分離
  - [ ] Header分離
  - [ ] カスタムフック化
- [ ] Field.tsx整理
  - [ ] ヘルパー関数の外出し
  - [ ] 定数の外出し
  - [ ] Canvas描画クラス化
  - [ ] イベントハンドラー分離
- [ ] テスト追加
  - [ ] ストアのテスト
  - [ ] ユニットテスト
  - [ ] 統合テスト
```

## 詳細な実装ガイド

### ステップ1: 型定義の統一 - 詳細

```typescript
// types/index.ts
export interface Player {
  id: string;
  x: number;
  y: number;
  team: 'offense' | 'defense';
  shape: 'circle' | 'square';
  color: string;
  label?: string;
}

export interface LineSegment {
  points: Point[];
  type: LineType;
  branches?: LineSegment[];
}

export interface Line {
  id: string;
  playerId: string;
  segments: LineSegment[];
}

export type Tool = 'select' | 'player' | 'route' | 'text' | 'formation';
export type LineType = 'solid' | 'dashed' | 'dotted';

// types/events.ts
export interface FieldMouseEvent {
  x: number;
  y: number;
  shiftKey: boolean;
  ctrlKey: boolean;
}
```

### ステップ2: Zustandストア - 詳細

```typescript
// stores/editorStore.ts
interface EditorState {
  // 状態
  players: Player[];
  lines: Line[];
  selectedElementId: string | null;
  selectedElementType: 'player' | 'line' | null;
  currentTool: Tool;

  // アクション
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  deletePlayer: (id: string) => void;

  addLine: (line: Line) => void;
  updateLine: (id: string, updates: Partial<Line>) => void;
  deleteLine: (id: string) => void;

  selectElement: (id: string, type: 'player' | 'line') => void;
  clearSelection: () => void;
  setTool: (tool: Tool) => void;
}

// stores/historyStore.ts
interface HistoryState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];

  undo: () => void;
  redo: () => void;
  checkpoint: () => void;
}
```

### ステップ3: コンポーネント分割 - 詳細

```typescript
// components/PropertyPanel/index.tsx
export const PropertyPanel: React.FC = () => {
  const { selectedElement, updateElement } = useEditorStore()

  if (!selectedElement) {
    return <EmptyState />
  }

  return selectedElement.type === 'player'
    ? <PlayerProperties />
    : <LineProperties />
}

// components/LeftToolbar/index.tsx
export const LeftToolbar: React.FC = () => {
  const { currentTool, setTool } = useEditorStore()

  return (
    <aside className="toolbar">
      {TOOLS.map(tool => (
        <ToolButton
          key={tool.id}
          tool={tool}
          isActive={currentTool === tool.id}
          onClick={() => setTool(tool.id)}
        />
      ))}
    </aside>
  )
}
```

### ステップ4: ユーティリティ関数 - 詳細

```typescript
// utils/geometry.ts
export const pointToLineDistance = (
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number => {
  // 実装
};

export const isPointInCircle = (
  point: Point,
  center: Point,
  radius: number,
): boolean => {
  // 実装
};

// utils/canvas/segments.ts
export const getSegmentByPath = (
  segments: LineSegment[],
  path: number[],
): LineSegment | null => {
  // 実装
};

export const updateSegmentByPath = (
  segments: LineSegment[],
  path: number[],
  updater: (segment: LineSegment) => void,
): LineSegment[] => {
  // 実装
};
```

### ステップ5: Canvas描画クラス - 詳細

```typescript
// renderers/FieldRenderer.ts
export class FieldRenderer {
  private ctx: CanvasRenderingContext2D;
  private dimensions: FieldDimensions;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.dimensions = calculateDimensions(width, height);
  }

  render(state: RenderState) {
    this.clear();
    this.drawField();
    this.drawLines(state.lines);
    this.drawPlayers(state.players);
    this.drawSelection(state.selection);
  }

  private drawField() {
    // フィールド描画ロジック
  }

  private drawPlayers(players: Player[]) {
    // プレイヤー描画ロジック
  }

  private drawLines(lines: Line[]) {
    // ライン描画ロジック
  }
}
```

## 期待される成果

### 定量的な改善

- **コード量**: 約40%削減（3000行 → 1800行）
- **複雑度**: 循環的複雑度が1/3に削減
- **テスタビリティ**: 単体テスト可能な部分が80%に向上
- **ビルド時間**: 20%高速化

### 定性的な改善

- **開発速度**: 新機能追加が2-3倍高速化
- **バグ率**: 新規バグの発生率が50%削減
- **オンボーディング**: 新規開発者の理解時間が半減
- **保守性**: コード変更の影響範囲が明確化

## リスク管理

### 想定されるリスクと対策

| リスク             | 影響度 | 発生確率 | 対策                           |
| ------------------ | ------ | -------- | ------------------------------ |
| 描画の不具合       | 高     | 中       | スクリーンショットテストの導入 |
| 状態の不整合       | 高     | 低       | 段階的移行とE2Eテスト          |
| パフォーマンス劣化 | 中     | 低       | Performance APIでの計測        |
| 型エラーの増加     | 低     | 中       | strict modeの段階的適用        |

## タイムライン

### 週次スケジュール（3週間想定）

**Week 1**

- Day 1-2: 型定義の統一
- Day 3-4: Zustandストア基本実装
- Day 5: テストとレビュー

**Week 2**

- Day 1-2: App.tsx分割
- Day 3-4: Field.tsxヘルパー外出し
- Day 5: 中間レビューと調整

**Week 3**

- Day 1-3: Canvas描画分離
- Day 4: テスト追加
- Day 5: 最終レビューとドキュメント更新

## 成功の判断基準

### 必須要件

- [ ] 全ての既存機能が正常動作
- [ ] テストが全てパス
- [ ] TypeScriptエラーがゼロ
- [ ] Lintエラーがゼロ

### 品質指標

- [ ] 各ファイルが500行以下
- [ ] 関数の循環的複雑度が10以下
- [ ] テストカバレッジ70%以上
- [ ] ビルド時間が現状以下

この計画に従って段階的にリファクタリングを進めることで、リスクを最小限に抑えながら、保守性の高いコードベースを実現できます。
