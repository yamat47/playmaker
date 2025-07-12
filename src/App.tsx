import Field, { type Player } from './components/Field';
import { useState, useRef, useEffect } from 'react';

// Responsive wrapper component that calculates field dimensions
function ResponsiveFieldWrapper({
  children,
}: {
  children: (width: number, height: number) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // Field aspect ratio (2:1)
      const fieldAspectRatio = 2;

      // Add padding (24px on each side)
      const padding = 24;
      const availableWidth = containerWidth - padding * 2;

      // Calculate dimensions that fit within container while maintaining aspect ratio
      let fieldWidth = availableWidth;
      let fieldHeight = fieldWidth / fieldAspectRatio;

      // If calculated height exceeds container height, scale based on height instead
      const availableHeight = containerHeight - padding * 2;
      if (fieldHeight > availableHeight) {
        fieldHeight = availableHeight;
        fieldWidth = fieldHeight * fieldAspectRatio;
      }

      // Ensure minimum size
      const minWidth = 400;
      const minHeight = 200;
      fieldWidth = Math.max(fieldWidth, minWidth);
      fieldHeight = Math.max(fieldHeight, minHeight);

      setDimensions({ width: fieldWidth, height: fieldHeight });
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-full flex items-center justify-center px-12 py-8"
    >
      {children(dimensions.width, dimensions.height)}
    </div>
  );
}

function App() {
  const [selectedElement] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<
    'select' | 'player' | 'eraser'
  >('select');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [startRouteDrawing, setStartRouteDrawing] = useState<{
    playerId: string;
    routeType: 'solid' | 'dashed' | 'dotted';
  } | null>(null);

  const updatePlayer = (playerId: string, updates: Partial<Player>) => {
    setPlayers((prevPlayers) =>
      prevPlayers.map((player) =>
        player.id === playerId ? { ...player, ...updates } : player,
      ),
    );
    if (selectedPlayer && selectedPlayer.id === playerId) {
      setSelectedPlayer({ ...selectedPlayer, ...updates });
    }
  };

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
            className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
              currentTool === 'select'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'hover:bg-blue-50 text-gray-600 hover:text-blue-600'
            }`}
            onClick={() => setCurrentTool('select')}
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
            className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
              currentTool === 'player'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'hover:bg-blue-50 text-gray-600 hover:text-blue-600'
            }`}
            onClick={() => setCurrentTool('player')}
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
            className={`w-10 h-10 flex items-center justify-center rounded transition-colors ${
              currentTool === 'eraser'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'hover:bg-blue-50 text-gray-600 hover:text-blue-600'
            }`}
            onClick={() => setCurrentTool('eraser')}
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
          <ResponsiveFieldWrapper>
            {(width, height) => (
              <Field
                width={width}
                height={height}
                currentTool={currentTool}
                selectedPlayerId={selectedPlayerId}
                players={players}
                onPlayersChange={setPlayers}
                onPlayerSelect={(playerId, player) => {
                  setSelectedPlayerId(playerId);
                  setSelectedPlayer(player || null);
                }}
                onPlayerUpdate={(playerId, updates) => {
                  updatePlayer(playerId, updates);
                }}
                onToolChange={setCurrentTool}
                startRouteDrawing={startRouteDrawing}
                onRouteDrawingStart={setStartRouteDrawing}
              />
            )}
          </ResponsiveFieldWrapper>
        </main>

        {/* Right Sidebar - Properties */}
        <aside className="w-64 bg-white border-l border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Properties</h2>
          {selectedPlayerId ? (
            <div className="space-y-4">
              {/* Player Information */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <div className="text-sm text-gray-700">Player</div>
              </div>

              {/* Shape Selection */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Shape
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`p-2 flex items-center justify-center rounded border transition-all ${
                      selectedPlayer?.shape === 'circle'
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 border-gray-300'
                    }`}
                    onClick={() => {
                      if (selectedPlayer) {
                        updatePlayer(selectedPlayer.id, { shape: 'circle' });
                      }
                    }}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-current" />
                  </button>
                  <button
                    className={`p-2 flex items-center justify-center rounded border transition-all ${
                      selectedPlayer?.shape === 'square'
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 border-gray-300'
                    }`}
                    onClick={() => {
                      if (selectedPlayer) {
                        updatePlayer(selectedPlayer.id, { shape: 'square' });
                      }
                    }}
                  >
                    <div className="w-5 h-5 border-2 border-current" />
                  </button>
                </div>
              </div>

              {/* Label Input */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedPlayer?.label || ''}
                  onChange={(e) => {
                    if (selectedPlayer) {
                      updatePlayer(selectedPlayer.id, {
                        label: e.target.value,
                      });
                    }
                  }}
                  placeholder="X, Y, DE, 8, 82..."
                  className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  maxLength={4}
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'White', value: '#ffffff' },
                    { name: 'Red', value: '#EF4444' },
                    { name: 'Green', value: '#10B981' },
                    { name: 'Yellow', value: '#F59E0B' },
                    { name: 'Purple', value: '#8B5CF6' },
                    { name: 'Pink', value: '#EC4899' },
                  ].map((color) => (
                    <button
                      key={color.value}
                      title={color.name}
                      className={`p-2 rounded border-2 transition-all ${
                        selectedPlayer?.color === color.value
                          ? 'border-gray-800 shadow-md'
                          : 'border-gray-300 hover:border-gray-500'
                      } ${color.value === '#ffffff' ? 'bg-white' : ''}`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => {
                        if (selectedPlayer) {
                          updatePlayer(selectedPlayer.id, {
                            color: color.value,
                          });
                        }
                      }}
                    >
                      {color.value === '#ffffff' && (
                        <div className="w-full h-full bg-gray-100 rounded-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Drawing Options */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Draw Route
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    title="Solid Line"
                    className={`p-3 flex items-center justify-center rounded border transition-all ${
                      startRouteDrawing?.routeType === 'solid'
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 border-gray-300'
                    }`}
                    onClick={() =>
                      setStartRouteDrawing({
                        playerId: selectedPlayerId,
                        routeType: 'solid',
                      })
                    }
                  >
                    <svg className="w-8 h-4" viewBox="0 0 32 16">
                      <line
                        x1="2"
                        y1="8"
                        x2="30"
                        y2="8"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                  <button
                    title="Dashed Line"
                    className={`p-3 flex items-center justify-center rounded border transition-all ${
                      startRouteDrawing?.routeType === 'dashed'
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 border-gray-300'
                    }`}
                    onClick={() =>
                      setStartRouteDrawing({
                        playerId: selectedPlayerId,
                        routeType: 'dashed',
                      })
                    }
                  >
                    <svg className="w-8 h-4" viewBox="0 0 32 16">
                      <line
                        x1="2"
                        y1="8"
                        x2="30"
                        y2="8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="5 3"
                      />
                    </svg>
                  </button>
                  <button
                    title="Dotted Line"
                    className={`p-3 flex items-center justify-center rounded border transition-all ${
                      startRouteDrawing?.routeType === 'dotted'
                        ? 'bg-blue-500 text-white border-blue-600'
                        : 'bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 border-gray-300'
                    }`}
                    onClick={() =>
                      setStartRouteDrawing({
                        playerId: selectedPlayerId,
                        routeType: 'dotted',
                      })
                    }
                  >
                    <svg className="w-8 h-4" viewBox="0 0 32 16">
                      <line
                        x1="2"
                        y1="8"
                        x2="30"
                        y2="8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="2 2"
                      />
                    </svg>
                  </button>
                </div>
                {startRouteDrawing && (
                  <p className="text-xs text-blue-600 mt-2">
                    Click on field to draw route
                  </p>
                )}
              </div>
            </div>
          ) : selectedElement ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <div className="text-sm text-gray-700">{selectedElement}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <p>No element selected</p>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-600">Tips:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Click a player to select</li>
                  <li>• Select route type to start drawing</li>
                  <li>• Press Enter to finish drawing</li>
                  <li>• Press Esc to cancel drawing</li>
                  <li>• Use Player tool to add players</li>
                  <li>• Use Eraser tool to delete</li>
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
