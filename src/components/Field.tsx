import { useRef, useEffect, useState } from 'react';

interface FieldProps {
  width?: number;
  height?: number;
  currentTool?: 'select' | 'player' | 'route' | 'eraser';
  selectedPlayerId?: string | null;
  onPlayerSelect?: (playerId: string | null) => void;
  startRouteDrawing?: {
    playerId: string;
    routeType: 'solid' | 'dashed' | 'dotted';
  } | null;
  onRouteDrawingStart?: (
    value: {
      playerId: string;
      routeType: 'solid' | 'dashed' | 'dotted';
    } | null,
  ) => void;
}

interface Player {
  id: string;
  x: number;
  y: number;
  team: 'offense' | 'defense';
}

interface Line {
  id: string;
  playerId: string;
  points: { x: number; y: number }[];
  type: 'solid' | 'dashed' | 'dotted';
}

// Helper function to check if a point is near a line segment
const pointToLineDistance = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

const Field = ({
  width = 1200,
  height = 600,
  currentTool = 'select',
  onPlayerSelect,
  startRouteDrawing,
  onRouteDrawingStart,
}: FieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draggingPlayer, setDraggingPlayer] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [drawingLine, setDrawingLine] = useState<Line | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [draggingLine, setDraggingLine] = useState<string | null>(null);
  const [lineDragOffset, setLineDragOffset] = useState({ x: 0, y: 0 });
  const [selectedPoint, setSelectedPoint] = useState<{
    lineId: string;
    pointIndex: number;
  } | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<boolean>(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Initialize players on first render
  useEffect(() => {
    if (players.length === 0) {
      const fieldWidthYards = 53.3;
      const displayYards = 30;
      const yardHeight = height / displayYards;
      const yardWidth = width / fieldWidthYards;
      const footToPixel = yardWidth / 3;
      const hashInsetFeet = 60;
      const hashInset = footToPixel * hashInsetFeet;
      const hashLeftX = hashInset;
      const hashRightX = width - hashInset;
      const fiftyYardLine = 15 * yardHeight;

      setPlayers([
        {
          id: 'offensive-1',
          x: hashLeftX,
          y: fiftyYardLine,
          team: 'offense',
        },
        {
          id: 'defensive-1',
          x: hashRightX,
          y: fiftyYardLine - yardHeight * 2,
          team: 'defense',
        },
      ]);
    }
  }, [width, height, players.length]);

  // Watch for route drawing start from props
  useEffect(() => {
    if (startRouteDrawing && startRouteDrawing.playerId) {
      const player = players.find((p) => p.id === startRouteDrawing.playerId);
      if (player) {
        setIsDrawingMode(true);
        setDrawingLine({
          id: `line-${Date.now()}`,
          playerId: player.id,
          points: [],
          type: startRouteDrawing.routeType,
        });
        setSelectedLineId(null);
        setSelectedPoint(null);
        // Clear the startRouteDrawing after initiating
        onRouteDrawingStart?.(null);
      }
    }
  }, [startRouteDrawing, players, onRouteDrawingStart]);

  // Drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // フィールドの緑色背景
    ctx.fillStyle = '#4a7c59';
    ctx.fillRect(0, 0, width, height);

    // フィールドの寸法計算
    // 実際のフィールド: 幅53.3ヤード、表示範囲30ヤード（35-65ヤード）
    const fieldWidthYards = 53.3;
    const displayYards = 30;
    const yardHeight = height / displayYards;
    const yardWidth = width / fieldWidthYards;

    // 単位変換（1ヤード = 3フィート = 36インチ）
    const inchToPixel = yardWidth / 36;
    const footToPixel = yardWidth / 3;

    // サイドラインの位置（実際のフィールドに合わせて）
    const sidelineLeft = 0;
    const sidelineRight = width;

    // サイドライン（4インチ幅）
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = inchToPixel * 4;
    ctx.beginPath();
    ctx.moveTo(sidelineLeft, 0);
    ctx.lineTo(sidelineLeft, height);
    ctx.moveTo(sidelineRight, 0);
    ctx.lineTo(sidelineRight, height);
    ctx.stroke();

    // 5ヤードごとの横線（35, 40, 45, 50, 55, 60, 65）
    // NCAAルール: サイドラインまで引く
    const lineInset = 0;
    ctx.lineWidth = inchToPixel * 4; // 4インチ幅
    for (let yard = 35; yard <= 65; yard += 5) {
      const y = (65 - yard) * yardHeight;
      ctx.beginPath();
      ctx.moveTo(sidelineLeft + lineInset, y);
      ctx.lineTo(sidelineRight - lineInset, y);
      ctx.stroke();
    }

    // 50ヤードラインの強調（他の線と同じ4インチ幅）
    ctx.lineWidth = inchToPixel * 4;
    ctx.strokeStyle = '#ffffff';
    const fiftyYardY = 15 * yardHeight; // 65-50=15
    ctx.beginPath();
    ctx.moveTo(sidelineLeft + lineInset, fiftyYardY);
    ctx.lineTo(sidelineRight - lineInset, fiftyYardY);
    ctx.stroke();

    // 1ヤードマーク（フィールド端とハッシュマーク）
    ctx.lineWidth = inchToPixel * 4; // 4インチ幅
    const markLength = inchToPixel * 24; // 24インチ（2フィート）長

    // フィールド端のマーク位置（4インチ内側）
    const leftMarkStart = sidelineLeft + inchToPixel * 4;
    const leftMarkEnd = leftMarkStart + markLength;
    const rightMarkEnd = sidelineRight - inchToPixel * 4;
    const rightMarkStart = rightMarkEnd - markLength;

    // ハッシュマークの位置（NCAAルール: サイドラインから60フィート）
    // フィールド幅160フィート、ハッシュ間40フィート
    const hashInsetFeet = 60; // 60フィート
    const hashInset = footToPixel * hashInsetFeet;
    // ハッシュマークは中心線上に配置
    const hashLeftX = hashInset;
    const hashRightX = width - hashInset;
    const hashLeftStart = hashLeftX - markLength / 2;
    const hashLeftEnd = hashLeftStart + markLength;
    const hashRightStart = hashRightX - markLength / 2;
    const hashRightEnd = hashRightStart + markLength;

    // 1ヤードごとのマーク描画
    for (let i = 0; i <= displayYards; i++) {
      if (i % 5 !== 0) {
        // 5ヤードラインでは描画しない
        const y = i * yardHeight;

        // 左端のマーク
        ctx.beginPath();
        ctx.moveTo(leftMarkStart, y);
        ctx.lineTo(leftMarkEnd, y);
        ctx.stroke();

        // 右端のマーク
        ctx.beginPath();
        ctx.moveTo(rightMarkStart, y);
        ctx.lineTo(rightMarkEnd, y);
        ctx.stroke();

        // 左側のハッシュマーク
        ctx.beginPath();
        ctx.moveTo(hashLeftStart, y);
        ctx.lineTo(hashLeftEnd, y);
        ctx.stroke();

        // 右側のハッシュマーク
        ctx.beginPath();
        ctx.moveTo(hashRightStart, y);
        ctx.lineTo(hashRightEnd, y);
        ctx.stroke();
      }
    }

    // ヤード数字の位置（NCAAルール: サイドラインから9ヤード内側、数字の上端まで）
    // 数字の高さを6フィートとして、上端が9ヤードになるよう調整
    const numberHeight = footToPixel * 6;
    const numberInset = yardWidth * 9 + numberHeight / 2; // 中心位置を調整

    // ヤード数字の描画
    ctx.font = 'bold 36px Arial'; // サイズを小さく
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 数字をヤードラインをまたぐ形で配置
    const yardNumbersConfig = [
      { digit1: '4', digit2: '0', yardLine: 40 },
      { digit1: '5', digit2: '0', yardLine: 50 },
      { digit1: '4', digit2: '0', yardLine: 60 },
    ];

    // 左側の数字（外から見て自然な向き）
    for (const { digit1, digit2, yardLine } of yardNumbersConfig) {
      const lineY = (65 - yardLine) * yardHeight;
      const digitSpacing = 16; // 数字間の間隔（より詰めて表示）

      // 第1桁（上側）
      ctx.save();
      ctx.translate(numberInset, lineY - digitSpacing);
      ctx.rotate(Math.PI / 2); // 右に90度回転（外から見て正しい向き）
      ctx.fillText(digit1, 0, 0);
      ctx.restore();

      // 第2桁（下側）
      ctx.save();
      ctx.translate(numberInset, lineY + digitSpacing);
      ctx.rotate(Math.PI / 2); // 右に90度回転（外から見て正しい向き）
      ctx.fillText(digit2, 0, 0);
      ctx.restore();

      // 矢印（50以外）- 18インチ×36インチ
      if (yardLine !== 50) {
        const arrowBase = inchToPixel * 18;
        const arrowHeight = inchToPixel * 36;
        const arrowOffset = footToPixel * 6; // 数字から6フィート離れた位置

        ctx.save();
        ctx.fillStyle = '#ffffff';

        if (yardLine === 40) {
          // 40ヤード - 矢印は数字の下（35ヤード方向）- 上向き矢印
          ctx.translate(numberInset, lineY + arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        } else if (yardLine === 60) {
          // 60ヤード - 矢印は数字の上（65ヤード方向）- 下向き矢印
          ctx.translate(numberInset, lineY - arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, -arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 右側の数字（外から見て自然な向き）
    for (const { digit1, digit2, yardLine } of yardNumbersConfig) {
      const lineY = (65 - yardLine) * yardHeight;
      const digitSpacing = 16; // 数字間の間隔（より詰めて表示）

      // 第1桁（下側に配置 - 右側は読み方向が逆）
      ctx.save();
      ctx.translate(width - numberInset, lineY + digitSpacing);
      ctx.rotate(-Math.PI / 2); // 左に90度回転（外から見て正しい向き）
      ctx.fillText(digit1, 0, 0);
      ctx.restore();

      // 第2桁（上側に配置 - 右側は読み方向が逆）
      ctx.save();
      ctx.translate(width - numberInset, lineY - digitSpacing);
      ctx.rotate(-Math.PI / 2); // 左に90度回転（外から見て正しい向き）
      ctx.fillText(digit2, 0, 0);
      ctx.restore();

      // 矢印（50以外）- 18インチ×36インチ
      if (yardLine !== 50) {
        const arrowBase = inchToPixel * 18;
        const arrowHeight = inchToPixel * 36;
        const arrowOffset = footToPixel * 6; // 数字から6フィート離れた位置

        ctx.save();
        ctx.fillStyle = '#ffffff';

        if (yardLine === 40) {
          // 40ヤード - 矢印は数字の下（35ヤード方向）- 上向き矢印
          ctx.translate(width - numberInset, lineY + arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        } else if (yardLine === 60) {
          // 60ヤード - 矢印は数字の上（65ヤード方向）- 下向き矢印
          ctx.translate(width - numberInset, lineY - arrowOffset);
          ctx.beginPath();
          ctx.moveTo(0, -arrowHeight);
          ctx.lineTo(arrowBase / 2, 0);
          ctx.lineTo(-arrowBase / 2, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 9ヤードマーク（ウィングマーク） - NCAAルール
    // 10ヤードラインごとに、サイドラインから9ヤード内側に12インチ長のマーク
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = inchToPixel * 4;

    // ラインを描画
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    // 完成したライン
    lines.forEach((line) => {
      if (line.points.length > 0) {
        const player = players.find((p) => p.id === line.playerId);
        if (!player) return;

        // 選択されているラインは別のスタイルで描画
        if (line.id === selectedLineId) {
          ctx.strokeStyle = '#4338ca'; // 濃い青紫
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
        }

        // 線種に応じてダッシュパターンを設定
        if (line.type === 'dashed') {
          ctx.setLineDash([10, 5]);
        } else if (line.type === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(player.x, player.y);

        line.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });

        ctx.stroke();
        ctx.setLineDash([]); // ダッシュパターンをリセット

        // 最後のセグメントに矢印を描画
        if (line.points.length > 0) {
          const lastPoint = line.points[line.points.length - 1];
          const prevPoint =
            line.points.length > 1
              ? line.points[line.points.length - 2]
              : player;

          const angle = Math.atan2(
            lastPoint.y - prevPoint.y,
            lastPoint.x - prevPoint.x,
          );
          const arrowLength = 15;
          const arrowAngle = Math.PI / 6;

          // 矢印の先端を描画
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(
            lastPoint.x - arrowLength * Math.cos(angle - arrowAngle),
            lastPoint.y - arrowLength * Math.sin(angle - arrowAngle),
          );
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(
            lastPoint.x - arrowLength * Math.cos(angle + arrowAngle),
            lastPoint.y - arrowLength * Math.sin(angle + arrowAngle),
          );
          ctx.stroke();
        }

        // 選択されたラインの場合、ポイントを表示
        if (line.id === selectedLineId) {
          ctx.fillStyle = '#4338ca';
          line.points.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // 選択されたポイントはさらに強調
            if (
              selectedPoint &&
              selectedPoint.lineId === line.id &&
              selectedPoint.pointIndex === index
            ) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          });
        }
      }
    });

    // 描画中のライン
    if (drawingLine) {
      const player = players.find((p) => p.id === drawingLine.playerId);
      if (player) {
        ctx.strokeStyle = '#666666';

        // 線種に応じてプレビューのダッシュパターンを設定
        if (drawingLine.type === 'dashed') {
          ctx.setLineDash([10, 5]);
        } else if (drawingLine.type === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else {
          ctx.setLineDash([5, 5]); // 実線のプレビューは薄い破線
        }

        ctx.beginPath();
        ctx.moveTo(player.x, player.y);

        drawingLine.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });

        // マウス位置までのプレビューライン
        if (isDrawingMode) {
          ctx.lineTo(mousePosition.x, mousePosition.y);
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 選手を描画
    const playerRadius = footToPixel * 1.5; // 1.5フィート（約45cm）

    players.forEach((player) => {
      // 選手の色（枠線なし）
      if (player.team === 'offense') {
        ctx.fillStyle = '#60a5fa'; // 明るい青色
      } else {
        ctx.fillStyle = '#f87171'; // 明るい赤色
      }

      // 選択されている場合は枠線を追加
      if (player.id === selectedPlayerId) {
        ctx.strokeStyle = '#4338ca';
        ctx.lineWidth = 3;
      }

      // 円を描画（枠線なし、文字なし）
      ctx.beginPath();
      ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
      ctx.fill();

      if (player.id === selectedPlayerId) {
        ctx.stroke();
      }
    });
  }, [
    width,
    height,
    players,
    lines,
    drawingLine,
    isDrawingMode,
    mousePosition,
    selectedLineId,
    selectedPoint,
    selectedPlayerId,
  ]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate player radius for hit detection
    const fieldWidthYards = 53.3;
    const yardWidth = width / fieldWidthYards;
    const footToPixel = yardWidth / 3;
    const playerRadius = footToPixel * 1.5;

    if (isDrawingMode && drawingLine) {
      // ダブルクリックの検出（300ms以内）
      const currentTime = Date.now();
      const timeDiff = currentTime - lastClickTime;

      if (timeDiff < 300 && drawingLine.points.length > 0) {
        // ダブルクリックで描画終了
        setLines([...lines, drawingLine]);
        setIsDrawingMode(false);
        setDrawingLine(null);
      } else {
        // 通常のクリックでポイント追加
        // 最小移動距離のチェック（10ピクセル）
        const MIN_DISTANCE = 10;
        let shouldAddPoint = true;

        if (drawingLine.points.length > 0) {
          const lastPoint = drawingLine.points[drawingLine.points.length - 1];
          const distance = Math.sqrt(
            (x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2,
          );
          if (distance < MIN_DISTANCE) {
            shouldAddPoint = false;
          }
        }

        if (shouldAddPoint) {
          setDrawingLine({
            ...drawingLine,
            points: [...drawingLine.points, { x, y }],
          });
        }
      }

      setLastClickTime(currentTime);
    } else if (currentTool === 'player') {
      // プレイヤー追加モード
      const newPlayer: Player = {
        id: `player-${Date.now()}`,
        x,
        y,
        team: 'offense',
      };
      setPlayers([...players, newPlayer]);
    } else if (currentTool === 'eraser') {
      // 消しゴムモード - プレイヤーをクリックして削除
      for (const player of players) {
        const distance = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
        if (distance <= playerRadius) {
          setPlayers(players.filter((p) => p.id !== player.id));
          // プレイヤーに関連するラインも削除
          setLines(lines.filter((l) => l.playerId !== player.id));
          break;
        }
      }

      // ラインをクリックして削除
      for (const line of lines) {
        const player = players.find((p) => p.id === line.playerId);
        if (!player) continue;

        let prevPoint = { x: player.x, y: player.y };
        for (const point of line.points) {
          const distance = pointToLineDistance(
            x,
            y,
            prevPoint.x,
            prevPoint.y,
            point.x,
            point.y,
          );
          if (distance < 5) {
            setLines(lines.filter((l) => l.id !== line.id));
            break;
          }
          prevPoint = point;
        }
      }
    } else {
      // 通常モード (select) またはルート描画モード (route)
      let playerClicked = false;
      for (const player of players) {
        const distance = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
        if (distance <= playerRadius) {
          playerClicked = true;
          if (currentTool === 'select') {
            // Select player
            setSelectedPlayerId(player.id);
            onPlayerSelect?.(player.id); // 親コンポーネントに通知
            setDraggingPlayer(player.id);
            setDragOffset({ x: x - player.x, y: y - player.y });
            setSelectedLineId(null);
            setSelectedPoint(null);
            // Also clear any line dragging state
            setDraggingLine(null);
            setLineDragOffset({ x: 0, y: 0 });
          }
          break;
        }
      }

      if (!playerClicked) {
        // If drawing mode is active, add points to the line
        if (isDrawingMode && drawingLine) {
          setDrawingLine({
            ...drawingLine,
            points: [...drawingLine.points, { x, y }],
          });
        } else {
          // Check if click is on a point
          let pointClicked = false;
          let lineClicked = false;

          if (selectedLineId) {
            const selectedLine = lines.find((l) => l.id === selectedLineId);
            if (selectedLine) {
              for (let i = 0; i < selectedLine.points.length; i++) {
                const point = selectedLine.points[i];
                const distance = Math.sqrt(
                  (x - point.x) ** 2 + (y - point.y) ** 2,
                );
                if (distance <= 8) {
                  // 8 pixels tolerance for points
                  setSelectedPoint({ lineId: selectedLineId, pointIndex: i });
                  setDraggingPoint(true);
                  pointClicked = true;
                  break;
                }
              }
            }
          }

          if (!pointClicked) {
            // Check if click is on a line
            for (const line of lines) {
              const player = players.find((p) => p.id === line.playerId);
              if (!player) continue;

              // Check each segment of the line
              let prevPoint = { x: player.x, y: player.y };
              for (const point of line.points) {
                const distance = pointToLineDistance(
                  x,
                  y,
                  prevPoint.x,
                  prevPoint.y,
                  point.x,
                  point.y,
                );
                if (distance < 5) {
                  // 5 pixels tolerance
                  setSelectedLineId(line.id);
                  setDraggingLine(line.id);
                  setLineDragOffset({ x, y });
                  setSelectedPoint(null);
                  lineClicked = true;
                  break;
                }
                prevPoint = point;
              }
              if (lineClicked) break;
            }
          }

          // If nothing was clicked (no player, line, or point), deselect
          if (!playerClicked && !lineClicked && !pointClicked) {
            setSelectedLineId(null);
            setSelectedPoint(null);
            setSelectedPlayerId(null);
            onPlayerSelect?.(null); // 親コンポーネントに通知
          }
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if hovering over a player
    const fieldWidthYards = 53.3;
    const yardWidth = width / fieldWidthYards;
    const footToPixel = yardWidth / 3;
    const playerRadius = footToPixel * 1.5;

    let isHovering = false;
    for (const player of players) {
      const distance = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
      if (distance <= playerRadius) {
        isHovering = true;
        setHoveredPlayer(player.id);
        break;
      }
    }

    if (!isHovering) {
      setHoveredPlayer(null);
    }

    // Handle player dragging
    if (draggingPlayer) {
      // dragOffset is the initial offset from player center to mouse
      // So new player position = current mouse position - initial offset
      const newPlayerX = x - dragOffset.x;
      const newPlayerY = y - dragOffset.y;

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === draggingPlayer
            ? { ...player, x: newPlayerX, y: newPlayerY }
            : player,
        ),
      );
    }

    // Handle point dragging
    if (draggingPoint && selectedPoint) {
      setLines((prevLines) =>
        prevLines.map((line) => {
          if (line.id === selectedPoint.lineId) {
            const oldPoint = line.points[selectedPoint.pointIndex];
            if (oldPoint) {
              const dx = x - oldPoint.x;
              const dy = y - oldPoint.y;

              // Move the selected point and all subsequent points
              return {
                ...line,
                points: line.points.map((point, index) => {
                  if (index === selectedPoint.pointIndex) {
                    // Move the selected point to mouse position
                    return { x, y };
                  } else if (index > selectedPoint.pointIndex) {
                    // Move subsequent points by the same delta
                    return {
                      x: point.x + dx,
                      y: point.y + dy,
                    };
                  }
                  // Keep previous points unchanged
                  return point;
                }),
              };
            }
          }
          return line;
        }),
      );
    } else if (draggingLine) {
      // Handle line dragging
      const dx = x - lineDragOffset.x;
      const dy = y - lineDragOffset.y;

      setLines((prevLines) =>
        prevLines.map((line) =>
          line.id === draggingLine
            ? {
                ...line,
                points: line.points.map((point) => ({
                  x: point.x + dx,
                  y: point.y + dy,
                })),
              }
            : line,
        ),
      );

      setLineDragOffset({ x, y });
    }

    // Store mouse position for preview line
    setMousePosition({ x, y });
  };

  const handleMouseUp = () => {
    setDraggingPlayer(null);
    setDraggingLine(null);
    setDraggingPoint(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isDrawingMode) {
      // Cancel line drawing
      setIsDrawingMode(false);
      setDrawingLine(null);
      onRouteDrawingStart?.(null);
    } else if (e.key === 'Enter' && isDrawingMode && drawingLine) {
      // Finish line drawing
      setLines([...lines, drawingLine]);
      setIsDrawingMode(false);
      setDrawingLine(null);
      onRouteDrawingStart?.(null);
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      selectedPlayerId
    ) {
      // Delete selected player
      setPlayers(players.filter((p) => p.id !== selectedPlayerId));
      setLines(lines.filter((l) => l.playerId !== selectedPlayerId));
      setSelectedPlayerId(null);
      onPlayerSelect?.(null);
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      selectedLineId
    ) {
      // Delete selected line
      setLines(lines.filter((l) => l.id !== selectedLineId));
      setSelectedLineId(null);
    }
  };

  // Add focus handling for keyboard events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && isDrawingMode) {
      canvas.focus();
    }
  }, [isDrawingMode]);

  // 右パネルから線描画を開始
  useEffect(() => {
    if (startRouteDrawing && selectedPlayerId === startRouteDrawing.playerId) {
      setIsDrawingMode(true);
      setDrawingLine({
        id: `line-${Date.now()}`,
        playerId: startRouteDrawing.playerId,
        points: [],
        type: startRouteDrawing.routeType,
      });
      setSelectedLineId(null);
      setSelectedPoint(null);
      // フォーカスを設定
      canvasRef.current?.focus();
    }
  }, [startRouteDrawing, selectedPlayerId]);

  // ツールが変更されたときに描画をキャンセル
  useEffect(() => {
    if (currentTool !== 'select' && isDrawingMode) {
      setIsDrawingMode(false);
      setDrawingLine(null);
      onRouteDrawingStart?.(null);
    }
  }, [currentTool, isDrawingMode, onRouteDrawingStart]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-300 shadow-lg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setHoveredPlayer(null)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        cursor:
          currentTool === 'player'
            ? 'copy'
            : currentTool === 'eraser'
              ? 'not-allowed'
              : currentTool === 'route' || isDrawingMode
                ? 'crosshair'
                : draggingPlayer || draggingLine || draggingPoint
                  ? 'grabbing'
                  : hoveredPlayer
                    ? 'grab'
                    : 'default',
      }}
    />
  );
};

export default Field;
