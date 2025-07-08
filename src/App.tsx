import Field from './components/Field';
import { useState } from 'react';

function App() {
  const [selectedElement] = useState<string | null>(null);

  const handleExport = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'play-diagram.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 shadow-sm">
        <h1 className="text-sm font-medium text-gray-700">Playmaker</h1>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools */}
        <aside className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 space-y-1">
          {/* Select/Move Tool */}
          {/* TODO: キャンバス上の要素（プレイヤー、ルート、テキスト等）を選択・移動できるツール
           * - クリックで要素選択
           * - ドラッグで位置移動
           * - 複数選択機能（Shiftキーや範囲選択）
           * - 選択した要素のプロパティを右サイドバーに表示
           */}
          <button
            title="Select"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
          </button>

          {/* Player Tool */}
          {/* TODO: プレイヤーをフィールドに配置するツール
           * - オフェンス/ディフェンスのプレイヤーアイコン
           * - ポジション番号や名前の表示
           * - ドラッグ&ドロップで配置
           * - スナップ機能（グリッドに吸着）
           */}
          <button
            title="Add Player"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </button>
          {/* Route Drawing Tool */}
          {/* TODO: パスルートやランプレイの動きを描画するツール
           * - 線種（実線、破線、点線、ジグザグ）
           * - 矢印、ブロック、丸などの終端記号
           * - ルートの深さ（ヤード数）表示
           * - プレスナップモーションの表現
           */}
          <button
            title="Draw Route"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
          {/* Formation Tool */}
          {/* TODO: プリセットのフォーメーションを配置するツール
           * - オフェンス：Iフォーメーション、ショットガン、ピストル等
           * - ディフェンス：4-3、4-4、3-4、ニッケル等
           * - カスタムフォーメーションの保存
           * - パーソネルグループの設定（11、12、21等）
           */}
          <button
            title="Formations"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"
              />
            </svg>
          </button>
          {/* Text/Label Tool */}
          {/* TODO: テキストやラベルを追加するツール
           * - プレイ名、コーチングポイント
           * - フォントサイズ、色の設定
           * - プレイヤーの役割やアサインメント
           * - フィールド上の任意の位置に配置
           */}
          <button
            title="Add Text"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          {/* Blocking Scheme Tool */}
          {/* TODO: ブロッキングスキームを表現するツール
           * - ブロックの方向を矢印で表示
           * - ゾーンブロッキング、マンブロッキング
           * - プル、トラップなどの特殊ブロック
           * - ブロックの責任者を明示
           */}
          <button
            title="Blocking"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </button>

          {/* Eraser Tool */}
          {/* TODO: 要素を削除するツール
           * - クリックで個別要素を削除
           * - ドラッグで範囲削除
           * - 削除対象のフィルター（プレイヤーのみ、ルートのみ等）
           * - 全削除機能
           */}
          <button
            title="Eraser"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>

          <div className="h-px bg-gray-200 w-8 my-2" />

          {/* Undo */}
          {/* TODO: 操作を元に戻す
           * - 直前の操作を取り消し
           * - キーボードショートカット（Ctrl/Cmd+Z）
           * - 履歴の管理（最大50操作程度）
           */}
          <button
            title="Undo"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>

          {/* Redo */}
          {/* TODO: 操作をやり直し
           * - 取り消した操作を再実行
           * - キーボードショートカット（Ctrl/Cmd+Y）
           */}
          <button
            title="Redo"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
              />
            </svg>
          </button>

          {/* Zoom In */}
          {/* TODO: キャンバスを拡大
           * - 10%ずつ拡大（最大250%）
           * - マウス位置を中心に拡大
           * - キーボードショートカット（Ctrl/Cmd++）
           */}
          <button
            title="Zoom In"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
              />
            </svg>
          </button>

          {/* Zoom Out */}
          {/* TODO: キャンバスを縮小
           * - 10%ずつ縮小（最小25%）
           * - キャンバス全体が見えるように調整
           * - キーボードショートカット（Ctrl/Cmd+-）
           * - フィットボタンも検討
           */}
          <button
            title="Zoom Out"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
              />
            </svg>
          </button>
          <div className="flex-1" />

          {/* Playbook */}
          {/* TODO: プレイブック管理機能
           * - プレイの保存・読み込み
           * - フォルダ構造（オフェンス、ディフェンス、スペシャルチーム）
           * - タグ付けと検索機能
           * - ゲームプラン作成
           * - テンプレートとして保存
           */}
          <button
            title="Playbook"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </button>

          {/* Share */}
          {/* TODO: チームへの共有機能
           * - プレイヤーやコーチへの配布
           * - リンク共有
           * - アクセス権限の設定
           * - 閲覧履歴の追跡
           * - PDFエクスポートの統合
           */}
          <button
            title="Share"
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 6.316C18.114 17.062 18 16.518 18 16c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M8.684 8.658C8.886 8.062 9 7.518 9 7c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684M12 19v-7m0 0V5m0 7h7m-7 0H5"
              />
            </svg>
          </button>
          {/* Export */}
          {/* TODO: エクスポート機能（現在はPNGのみ）
           * - PDFエクスポート
           * - プレイカード形式
           * - リストバンド用シート
           * - プラクティススクリプト
           * - プレゼンテーション用画像
           */}
          <button
            onClick={handleExport}
            className="w-10 h-10 flex items-center justify-center rounded hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        </aside>

        {/* Center - Canvas */}
        <main className="flex-1 bg-gray-100 overflow-auto">
          <div className="min-h-full flex items-center justify-center p-8">
            <Field />
          </div>
        </main>

        {/* Right Sidebar - Properties */}
        <aside className="w-64 bg-white border-l border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Properties</h2>
          {selectedElement ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <div className="text-sm text-gray-700">{selectedElement}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="X"
                    className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Y"
                    className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No element selected</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
