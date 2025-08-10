import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';

interface FieldProps {
  width?: number;
  height?: number;
  currentTool?: 'select' | 'player';
  selectedPlayerId?: string | null;
  players?: Player[];
  onPlayersChange?: (players: Player[]) => void;
  lines?: Line[];
  onLinesChange?: (lines: Line[]) => void;
  onPlayerSelect?: (playerId: string | null, player?: Player) => void;
  onPlayerUpdate?: (playerId: string, updates: Partial<Player>) => void;
  onToolChange?: (tool: 'select' | 'player') => void;
  onLineSelect?: (
    lineId: string | null,
    lines?: Line[],
    segmentPath?: number[],
  ) => void;
  startRouteDrawing?: {
    playerId?: string;
    lineId?: string;
    routeType: 'solid' | 'dashed' | 'dotted';
  } | null;
  onRouteDrawingStart?: (
    value: {
      playerId?: string;
      lineId?: string;
      routeType: 'solid' | 'dashed' | 'dotted';
    } | null,
  ) => void;
  onLineTypeChange?: (
    lineId: string,
    segmentPath: number[],
    newType: 'solid' | 'dashed' | 'dotted',
  ) => void;
}

interface FieldRef {
  changeSegmentType: (
    lineId: string,
    segmentPath: number[],
    newType: 'solid' | 'dashed' | 'dotted',
  ) => void;
}

interface Player {
  id: string;
  x: number;
  y: number;
  team: 'offense' | 'defense';
  shape: 'circle' | 'square';
  color: string;
  label?: string;
}

interface LineSegment {
  points: { x: number; y: number }[];
  type: 'solid' | 'dashed' | 'dotted';
  branches?: LineSegment[]; // Branches from the end of this segment
}

interface Line {
  id: string;
  playerId: string;
  segments: LineSegment[];
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

const Field = forwardRef<FieldRef, FieldProps>(
  (
    {
      width = 1200,
      height = 600,
      currentTool = 'select',
      players: externalPlayers,
      onPlayersChange,
      lines: externalLines,
      onLinesChange,
      onPlayerSelect,
      onPlayerUpdate,
      onToolChange,
      onLineSelect,
      startRouteDrawing,
      onRouteDrawingStart,
      onLineTypeChange,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [internalPlayers, setInternalPlayers] = useState<Player[]>([]);
    const players = externalPlayers || internalPlayers;
    const setPlayers = (
      newPlayers: Player[] | ((prev: Player[]) => Player[]),
    ) => {
      if (onPlayersChange) {
        if (typeof newPlayers === 'function') {
          onPlayersChange(newPlayers(players));
        } else {
          onPlayersChange(newPlayers);
        }
      } else {
        setInternalPlayers(newPlayers);
      }
    };
    const [internalLines, setInternalLines] = useState<Line[]>([]);
    const lines = externalLines || internalLines;
    const setLines = (
      newLines: Line[] | ((prev: Line[]) => Line[]),
    ) => {
      if (onLinesChange) {
        if (typeof newLines === 'function') {
          onLinesChange(newLines(lines));
        } else {
          onLinesChange(newLines);
        }
      } else {
        setInternalLines(newLines);
      }
    };
    const [draggingPlayer, setDraggingPlayer] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
    const [selectedSegmentPath, setSelectedSegmentPath] = useState<
      number[] | null
    >(null); // Path to selected segment (including branches)
    const [draggingLine, setDraggingLine] = useState<string | null>(null);
    const [lineDragOffset, setLineDragOffset] = useState({ x: 0, y: 0 });
    const [selectedPoint, setSelectedPoint] = useState<{
      lineId: string;
      pointIndex: number;
    } | null>(null);
    const [draggingPoint, setDraggingPoint] = useState<boolean>(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
      null,
    );

    // Helper function to change line segment type
    const changeSegmentType = (
      lineId: string,
      segmentPath: number[],
      newType: 'solid' | 'dashed' | 'dotted',
    ) => {
      setLines((prevLines) =>
        prevLines.map((line) => {
          if (line.id === lineId) {
            const newSegments = [...line.segments];

            // Helper function to update segment by path
            const updateSegmentByPath = (
              segments: LineSegment[],
              path: number[],
              updater: (segment: LineSegment) => void,
            ): void => {
              if (path.length === 0) return;

              let currentSegment = segments[path[0]];
              for (let i = 1; i < path.length; i++) {
                if (!currentSegment.branches) currentSegment.branches = [];
                currentSegment = currentSegment.branches[path[i]];
              }
              updater(currentSegment);
            };

            updateSegmentByPath(newSegments, segmentPath, (segment) => {
              segment.type = newType;
            });

            return { ...line, segments: newSegments };
          }
          return line;
        }),
      );

      // Call parent callback if provided
      onLineTypeChange?.(lineId, segmentPath, newType);
    };

    // Expose functions to parent component
    useImperativeHandle(ref, () => ({
      changeSegmentType,
    }));

    // Initialize players on first render
    useEffect(() => {
      if (players.length === 0) {
        const fieldWidthYards = 53.3;
        const displayYards = 30;

        // 初期配置のための計算（描画時と同じ計算）
        const tempInchToPixel = width / fieldWidthYards / 36;
        const horizontalLineThickness = tempInchToPixel * 4;
        const effectiveHeight = height - horizontalLineThickness;
        const yardHeight = effectiveHeight / displayYards;
        const topOffset = horizontalLineThickness / 2;

        const tempYardWidth = width / fieldWidthYards;
        const tempInchToPixelWidth = tempYardWidth / 36;
        const sidelineThickness = tempInchToPixelWidth * 4;
        const effectiveWidth = width - sidelineThickness;
        const yardWidth = effectiveWidth / fieldWidthYards;

        const footToPixel = yardWidth / 3;
        const hashInsetFeet = 60;
        const hashInset = footToPixel * hashInsetFeet;
        const hashLeftX = sidelineThickness / 2 + hashInset;
        const hashRightX = width - sidelineThickness / 2 - hashInset;
        const fiftyYardLine = topOffset + 15 * yardHeight;

        setPlayers([
          {
            id: 'offensive-1',
            x: hashLeftX,
            y: fiftyYardLine,
            team: 'offense',
            shape: 'circle',
            color: '#ffffff', // 白色（無色）
            label: 'X',
          },
          {
            id: 'defensive-1',
            x: hashRightX,
            y: fiftyYardLine - yardHeight * 2,
            team: 'defense',
            shape: 'circle',
            color: '#EF4444',
            label: 'DE',
          },
        ]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height, players.length]);

    // Watch for route drawing start from props
    useEffect(() => {
      if (startRouteDrawing) {
        // Calculate yard to pixel conversion
        const fieldWidthYards = 53.3;
        const displayYards = 30;
        const tempInchToPixel = width / fieldWidthYards / 36;
        const horizontalLineThickness = tempInchToPixel * 4;
        const effectiveHeight = height - horizontalLineThickness;
        const yardHeight = effectiveHeight / displayYards;

        if (startRouteDrawing.playerId) {
          // Create line from player
          const player = players.find(
            (p) => p.id === startRouteDrawing.playerId,
          );
          if (player) {
            // Create a vertical line (gut pattern) - 5 yards up
            const gutLength = yardHeight * 5; // 5 yards in pixels
            const newLine: Line = {
              id: `line-${Date.now()}`,
              playerId: player.id,
              segments: [
                {
                  points: [{ x: player.x, y: player.y - gutLength }],
                  type: startRouteDrawing.routeType,
                },
              ],
            };

            // Add the line directly to the lines array
            setLines([...lines, newLine]);
            setSelectedLineId(newLine.id);
            setSelectedSegmentPath([0]); // Select the first (and only) segment
            setSelectedPoint(null);

            // Clear player selection when creating a line
            setSelectedPlayerId(null);
            onPlayerSelect?.(null);
            onLineSelect?.(newLine.id, [...lines, newLine], [0]);

            // Clear the startRouteDrawing after creating the line
            onRouteDrawingStart?.(null);
          }
        } else if (startRouteDrawing.lineId) {
          // Add a branch to the existing line
          const lineToExtend = lines.find(
            (l) => l.id === startRouteDrawing.lineId,
          );

          // If a point is selected, add line from that point
          if (
            lineToExtend &&
            selectedPoint &&
            selectedPoint.lineId === startRouteDrawing.lineId
          ) {
            // Helper function to find segment path and point index within segment
            const findPointPath = (
              segments: LineSegment[],
              targetIndex: number,
              currentPath: number[] = [],
            ): { path: number[]; localIndex: number } | null => {
              let currentIndex = 0;

              for (let segIdx = 0; segIdx < segments.length; segIdx++) {
                const segment = segments[segIdx];

                // Check points in this segment
                if (currentIndex + segment.points.length > targetIndex) {
                  // Point is in this segment
                  const localIndex = targetIndex - currentIndex;
                  return { path: [...currentPath, segIdx], localIndex };
                }
                currentIndex += segment.points.length;

                // Check branches
                if (segment.branches) {
                  for (
                    let branchIdx = 0;
                    branchIdx < segment.branches.length;
                    branchIdx++
                  ) {
                    const branchResult = findPointPath(
                      [segment.branches[branchIdx]],
                      targetIndex - currentIndex,
                      [...currentPath, segIdx, branchIdx],
                    );
                    if (branchResult) return branchResult;

                    // Count points in branch
                    const countBranchPoints = (branch: LineSegment): number => {
                      let count = branch.points.length;
                      if (branch.branches) {
                        branch.branches.forEach(
                          (b) => (count += countBranchPoints(b)),
                        );
                      }
                      return count;
                    };
                    currentIndex += countBranchPoints(
                      segment.branches[branchIdx],
                    );
                  }
                }
              }

              return null;
            };

            const pointInfo = findPointPath(
              lineToExtend.segments,
              selectedPoint.pointIndex,
            );
            if (pointInfo) {
              // Get the segment containing the selected point
              const getSegmentByPath = (
                segments: LineSegment[],
                path: number[],
              ): LineSegment | null => {
                if (path.length === 0) return null;
                let currentSegment = segments[path[0]];
                for (let i = 1; i < path.length; i++) {
                  if (
                    !currentSegment.branches ||
                    !currentSegment.branches[path[i]]
                  )
                    return null;
                  currentSegment = currentSegment.branches[path[i]];
                }
                return currentSegment;
              };

              const segment = getSegmentByPath(
                lineToExtend.segments,
                pointInfo.path,
              );
              if (segment && pointInfo.localIndex < segment.points.length) {
                const selectedPointPos = segment.points[pointInfo.localIndex];
                const gutLength = yardHeight * 5; // 5 yards in pixels

                // Split the segment at the selected point and add a new branch
                const updatedLines = lines.map((line) => {
                  if (line.id === startRouteDrawing.lineId) {
                    const newSegments = [...line.segments];

                    // Update segment by path
                    const updateSegmentByPath = (
                      segments: LineSegment[],
                      path: number[],
                      updater: (segment: LineSegment) => void,
                    ): void => {
                      if (path.length === 0) return;

                      let currentSegment = segments[path[0]];
                      for (let i = 1; i < path.length; i++) {
                        if (!currentSegment.branches)
                          currentSegment.branches = [];
                        currentSegment = currentSegment.branches[path[i]];
                      }
                      updater(currentSegment);
                    };

                    updateSegmentByPath(newSegments, pointInfo.path, (seg) => {
                      // If the point is at the end, just add a branch
                      if (pointInfo.localIndex === seg.points.length - 1) {
                        if (!seg.branches) seg.branches = [];
                        seg.branches.push({
                          points: [
                            {
                              x: selectedPointPos.x,
                              y: selectedPointPos.y - gutLength,
                            },
                          ],
                          type: startRouteDrawing.routeType,
                        });
                      } else {
                        // Split the segment at the selected point
                        const pointsBefore = seg.points.slice(
                          0,
                          pointInfo.localIndex + 1,
                        );
                        const pointsAfter = seg.points.slice(
                          pointInfo.localIndex,
                        );

                        // Keep original segment up to selected point
                        seg.points = pointsBefore;

                        // Add the continuation as a branch
                        if (!seg.branches) seg.branches = [];

                        // Add original continuation
                        if (pointsAfter.length > 1) {
                          seg.branches.push({
                            points: pointsAfter.slice(1), // Skip the shared point
                            type: seg.type,
                            branches: seg.branches
                              ? [...seg.branches]
                              : undefined,
                          });
                        }

                        // Add new branch
                        seg.branches.push({
                          points: [
                            {
                              x: selectedPointPos.x,
                              y: selectedPointPos.y - gutLength,
                            },
                          ],
                          type: startRouteDrawing.routeType,
                        });
                      }
                    });

                    return { ...line, segments: newSegments };
                  }
                  return line;
                });

                setLines(updatedLines);

                // Select the new branch
                const newBranchPath = [
                  ...pointInfo.path,
                  segment.branches ? segment.branches.length : 0,
                ];
                setSelectedLineId(startRouteDrawing.lineId);
                setSelectedSegmentPath(newBranchPath);
                setSelectedPoint(null);
                onLineSelect?.(
                  startRouteDrawing.lineId,
                  updatedLines,
                  newBranchPath,
                );

                // Clear the startRouteDrawing after creating the branch
                onRouteDrawingStart?.(null);
                return; // Exit early
              }
            }
          }

          // Original logic for adding from segment endpoint
          if (
            lineToExtend &&
            lineToExtend.segments.length > 0 &&
            selectedSegmentPath
          ) {
            // Helper function to get segment by path
            const getSegmentByPath = (
              segments: LineSegment[],
              path: number[],
            ): LineSegment | null => {
              if (path.length === 0) return null;
              let currentSegment = segments[path[0]];
              for (let i = 1; i < path.length; i++) {
                if (
                  !currentSegment.branches ||
                  !currentSegment.branches[path[i]]
                )
                  return null;
                currentSegment = currentSegment.branches[path[i]];
              }
              return currentSegment;
            };

            // Helper function to update segment by path
            const updateSegmentByPath = (
              segments: LineSegment[],
              path: number[],
              updater: (segment: LineSegment) => void,
            ): LineSegment[] => {
              const newSegments = [...segments];
              if (path.length === 0) return newSegments;

              let currentSegment = newSegments[path[0]];
              for (let i = 1; i < path.length; i++) {
                if (!currentSegment.branches) currentSegment.branches = [];
                currentSegment = currentSegment.branches[path[i]];
              }
              updater(currentSegment);
              return newSegments;
            };

            const selectedSegment = getSegmentByPath(
              lineToExtend.segments,
              selectedSegmentPath,
            );
            if (selectedSegment) {
              const lastPoint =
                selectedSegment.points[selectedSegment.points.length - 1];
              const gutLength = yardHeight * 5; // 5 yards in pixels

              // Create a new branch segment
              const newBranch: LineSegment = {
                points: [{ x: lastPoint.x, y: lastPoint.y - gutLength }],
                type: startRouteDrawing.routeType,
              };

              // Track the new branch index
              let newBranchIndex = 0;

              // Update the line with the new branch
              const updatedLines = lines.map((line) => {
                if (line.id === startRouteDrawing.lineId) {
                  const updatedSegments = updateSegmentByPath(
                    line.segments,
                    selectedSegmentPath,
                    (segment) => {
                      if (!segment.branches) segment.branches = [];
                      newBranchIndex = segment.branches.length; // Get the index before adding
                      segment.branches.push(newBranch);
                    },
                  );

                  return {
                    ...line,
                    segments: updatedSegments,
                  };
                }
                return line;
              });

              setLines(updatedLines);

              // Select the new branch
              const newPath = [...selectedSegmentPath, newBranchIndex];
              setSelectedLineId(startRouteDrawing.lineId);
              setSelectedSegmentPath(newPath);
              setSelectedPoint(null);
              onLineSelect?.(startRouteDrawing.lineId, updatedLines, newPath);

              // Clear the startRouteDrawing after creating the branch
              onRouteDrawingStart?.(null);
            }
          }
        }
      }
    }, [
      startRouteDrawing,
      players,
      lines,
      selectedSegmentPath,
      selectedPoint,
      onRouteDrawingStart,
      onPlayerSelect,
      onLineSelect,
      width,
      height,
    ]);

    // Drawing effect
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 高解像度ディスプレイ対応
      const dpr = window.devicePixelRatio || 1;

      // Canvasの実際のサイズを設定
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      // CSSサイズを維持
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // コンテキストをスケール
      if (ctx.scale) {
        ctx.scale(dpr, dpr);
      }

      // フィールドの白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // フィールドの寸法計算
      // 実際のフィールド: 幅53.3ヤード、表示範囲30ヤード（35-65ヤード）
      const fieldWidthYards = 53.3;
      const displayYards = 30;

      // 上下の線の太さを考慮して実際のフィールド高さを計算
      const tempInchToPixel = width / fieldWidthYards / 36;
      const horizontalLineThickness = tempInchToPixel * 4;
      const effectiveHeight = height - horizontalLineThickness; // 上下の線の内側間の高さ
      const yardHeight = effectiveHeight / displayYards;
      const topOffset = horizontalLineThickness / 2; // 上端からのオフセット

      // サイドラインの太さを考慮して実際のフィールド幅を計算
      const tempYardWidth = width / fieldWidthYards;
      const tempInchToPixelSide = tempYardWidth / 36;
      const sidelineThickness = tempInchToPixelSide * 4;
      const effectiveWidth = width - sidelineThickness; // サイドラインの内側間の幅
      const yardWidth = effectiveWidth / fieldWidthYards;

      // 単位変換（1ヤード = 3フィート = 36インチ）
      const inchToPixel = yardWidth / 36;
      const footToPixel = yardWidth / 3;

      // サイドラインの位置
      const sidelineLeft = sidelineThickness / 2;
      const sidelineRight = width - sidelineThickness / 2;

      // サイドライン（太い線）
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = inchToPixel * 4; // 4インチ幅
      ctx.beginPath();
      ctx.moveTo(sidelineLeft, 0);
      ctx.lineTo(sidelineLeft, height);
      ctx.moveTo(sidelineRight, 0);
      ctx.lineTo(sidelineRight, height);
      ctx.stroke();

      // 5ヤードごとの横線（35, 40, 45, 50, 55, 60, 65）
      // NCAAルール: サイドラインまで引く
      const lineInset = 0;
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = inchToPixel * 4; // 4インチ幅
      for (let yard = 35; yard <= 65; yard += 5) {
        const y = topOffset + (65 - yard) * yardHeight;
        ctx.beginPath();
        ctx.moveTo(sidelineLeft + lineInset, y);
        ctx.lineTo(sidelineRight - lineInset, y);
        ctx.stroke();
      }

      // 50ヤードラインの強調
      ctx.lineWidth = inchToPixel * 4; // 4インチ幅
      ctx.strokeStyle = '#999999';
      const fiftyYardY = topOffset + 15 * yardHeight; // 65-50=15
      ctx.beginPath();
      ctx.moveTo(sidelineLeft + lineInset, fiftyYardY);
      ctx.lineTo(sidelineRight - lineInset, fiftyYardY);
      ctx.stroke();

      // 1ヤードマーク（フィールド端とハッシュマーク）
      ctx.lineWidth = inchToPixel * 2; // 2インチ幅（細い線）
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
          const y = topOffset + i * yardHeight;

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
      ctx.fillStyle = '#CCCCCC'; // 薄いグレーで塗りつぶし
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
        const lineY = topOffset + (65 - yardLine) * yardHeight;
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
          ctx.fillStyle = '#CCCCCC'; // 薄いグレーで塗りつぶし

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
        const lineY = topOffset + (65 - yardLine) * yardHeight;
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
          ctx.fillStyle = '#CCCCCC'; // 薄いグレーで塗りつぶし

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

      // Helper function to compare segment paths
      const isPathEqual = (
        path1: number[],
        path2: number[] | null,
      ): boolean => {
        if (!path2) return false;
        if (path1.length !== path2.length) return false;
        return path1.every((val, idx) => val === path2[idx]);
      };

      // Helper function to recursively draw segments and their branches
      const drawSegmentAndBranches = (
        segment: LineSegment,
        startPos: { x: number; y: number },
        lineId: string,
        currentPath: number[],
        isLastSegmentInBranch: boolean,
      ) => {
        // Only highlight segment if no point is selected
        const isSegmentSelected =
          !selectedPoint &&
          lineId === selectedLineId &&
          isPathEqual(currentPath, selectedSegmentPath);

        // For selected dashed/dotted segments, draw a blue glow behind
        if (
          isSegmentSelected &&
          (segment.type === 'dashed' || segment.type === 'dotted')
        ) {
          // Draw multiple layers with decreasing opacity
          for (let i = 5; i >= 1; i--) {
            ctx.save();
            ctx.strokeStyle = `rgba(12, 140, 233, ${0.08 / i})`;
            ctx.lineWidth = 4 + i * 4;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            segment.points.forEach((point) => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.restore();
          }
        }

        // For selected solid segments, use native shadow
        if (isSegmentSelected && segment.type === 'solid') {
          ctx.save();
          ctx.shadowColor = '#0C8CE9';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // 線の色を選手の枠線と同じグレーに
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = isSegmentSelected ? 4 : 3;

        // Set dash pattern for this segment
        if (segment.type === 'dashed') {
          ctx.setLineDash([10, 5]);
        } else if (segment.type === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);

        // Draw all points in this segment
        segment.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });

        ctx.stroke();

        // Restore context if shadow was applied
        if (isSegmentSelected && segment.type === 'solid') {
          ctx.restore();
        }

        // Get the end position of this segment
        const endPos =
          segment.points.length > 0
            ? segment.points[segment.points.length - 1]
            : startPos;

        // Draw arrow only if this is the last segment and has no branches
        if (
          isLastSegmentInBranch &&
          (!segment.branches || segment.branches.length === 0)
        ) {
          const prevPoint =
            segment.points.length > 1
              ? segment.points[segment.points.length - 2]
              : startPos;

          const angle = Math.atan2(
            endPos.y - prevPoint.y,
            endPos.x - prevPoint.x,
          );
          const arrowLength = 15;
          const arrowAngle = Math.PI / 6;

          // 矢印の先端を三角形で描画
          ctx.save();
          ctx.fillStyle = '#666666'; // 線と同じ色

          // 三角形の重心を計算して、先端が線の終点に来るようにオフセット
          const centerOffset = arrowLength / 3; // 三角形の重心は底辺から高さの1/3

          const tipX = endPos.x + centerOffset * Math.cos(angle);
          const tipY = endPos.y + centerOffset * Math.sin(angle);

          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(
            tipX - arrowLength * Math.cos(angle - arrowAngle),
            tipY - arrowLength * Math.sin(angle - arrowAngle),
          );
          ctx.lineTo(
            tipX - arrowLength * Math.cos(angle + arrowAngle),
            tipY - arrowLength * Math.sin(angle + arrowAngle),
          );
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Draw branches if they exist
        if (segment.branches && segment.branches.length > 0) {
          segment.branches.forEach((branch, branchIndex) => {
            ctx.setLineDash([]); // Reset dash pattern
            drawSegmentAndBranches(
              branch,
              endPos,
              lineId,
              [...currentPath, branchIndex],
              true,
            );
          });
        }

        return endPos;
      };

      // 完成したライン
      lines.forEach((line) => {
        if (line.segments.length > 0) {
          const player = players.find((p) => p.id === line.playerId);
          if (!player) return;

          // Draw each segment with its own style
          let currentPosition = { x: player.x, y: player.y };

          line.segments.forEach((segment, segmentIndex) => {
            const isLastSegment = segmentIndex === line.segments.length - 1;
            currentPosition = drawSegmentAndBranches(
              segment,
              currentPosition,
              line.id,
              [segmentIndex],
              isLastSegment,
            );
          });

          ctx.setLineDash([]); // ダッシュパターンをリセット

          // Helper function to recursively draw points for segments and branches
          const drawSegmentPoints = (
            segment: LineSegment,
            globalIndexRef: { value: number },
          ) => {
            segment.points.forEach((point) => {
              // Don't skip any points - allow dragging the arrowhead too

              // 白い円を描画
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
              ctx.fill();

              // 枠線を描画
              ctx.strokeStyle = '#666666';
              ctx.lineWidth = 2;
              ctx.stroke();

              // 選択されたポイントはさらに強調
              if (
                selectedPoint &&
                selectedPoint.lineId === line.id &&
                selectedPoint.pointIndex === globalIndexRef.value
              ) {
                ctx.strokeStyle = '#0C8CE9';
                ctx.lineWidth = 3;
                ctx.stroke();
              }

              globalIndexRef.value++;
            });

            // Draw points for branches
            if (segment.branches) {
              segment.branches.forEach((branch) => {
                drawSegmentPoints(branch, globalIndexRef);
              });
            }
          };

          // 選択されたライン、またはポイントが選択されている場合、ポイントを表示
          if (
            line.id === selectedLineId ||
            (selectedPoint && selectedPoint.lineId === line.id)
          ) {
            const globalIndexRef = { value: 0 };
            line.segments.forEach((segment) => {
              drawSegmentPoints(segment, globalIndexRef);
            });
          }
        }
      });

      // 選手を描画
      const playerRadius = footToPixel * 2; // 2フィート（約60cm）- ひと回り大きく

      players.forEach((player) => {
        // 選択時の青いグローエフェクトを先に描画
        if (player.id === selectedPlayerId) {
          ctx.save();
          // シャドウ（blur）を設定 - より濃く
          ctx.shadowColor = '#0C8CE9';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          // 選択時: 透明なアウトライン（blurのみ表示するため）
          ctx.strokeStyle = 'transparent';
          ctx.lineWidth = 0;

          // シャドウを適用するために形を描画
          if (player.shape === 'square') {
            const size = playerRadius * 1.5;
            ctx.fillStyle = 'rgba(12, 140, 233, 0.8)';
            ctx.fillRect(player.x - size / 2, player.y - size / 2, size, size);
          } else {
            ctx.fillStyle = 'rgba(12, 140, 233, 0.8)';
            ctx.beginPath();
            ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 選手の色（白色をデフォルトに）
        ctx.fillStyle = player.color || '#ffffff';

        // 形状に応じて描画
        if (player.shape === 'square') {
          // 四角形を描画
          const size = playerRadius * 1.5;
          ctx.fillRect(player.x - size / 2, player.y - size / 2, size, size);
          // やや濃いグレーの枠線
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 2;
          ctx.strokeRect(player.x - size / 2, player.y - size / 2, size, size);
        } else {
          // 円を描画（デフォルト）
          ctx.beginPath();
          ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
          ctx.fill();
          // やや濃いグレーの枠線
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // ラベルを描画
        if (player.label) {
          ctx.save();

          // テキストのスタイル設定
          ctx.fillStyle = '#FFFFFF'; // 白文字
          ctx.strokeStyle =
            player.color === '#ffffff' ? '#666666' : player.color || '#666666'; // 白の場合はグレーで縁取り
          ctx.lineWidth = 3;
          ctx.font = `bold ${playerRadius * 0.8}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // フォントのメトリクスを考慮した調整
          const textY = player.y + playerRadius * 0.1; // 少し下に調整

          // テキストに縁取りをつけて描画
          if (ctx.strokeText) {
            ctx.strokeText(player.label, player.x, textY);
          }
          ctx.fillText(player.label, player.x, textY);

          ctx.restore();
        }
      });
    }, [
      width,
      height,
      players,
      lines,
      selectedLineId,
      selectedSegmentPath,
      selectedPoint,
      selectedPlayerId,
      hoveredPlayer,
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
      const playerRadius = footToPixel * 2; // 2フィート（約60cm）- ひと回り大きく

      if (currentTool === 'player') {
        // プレイヤー追加モード
        const newPlayer: Player = {
          id: `player-${Date.now()}`,
          x,
          y,
          team: 'offense',
          shape: 'circle',
          color: '#ffffff', // デフォルトは白色（無色）
          label: '', // デフォルトは空
        };
        setPlayers([...players, newPlayer]);

        // 選手を追加したら選択モードに戻る
        onToolChange?.('select');
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
              onPlayerSelect?.(player.id, player); // 親コンポーネントに通知
              setDraggingPlayer(player.id);
              setDragOffset({ x: x - player.x, y: y - player.y });
              setSelectedLineId(null);
              setSelectedSegmentPath(null);
              setSelectedPoint(null);
              // Also clear any line dragging state
              setDraggingLine(null);
              setLineDragOffset({ x: 0, y: 0 });
              onLineSelect?.(null, lines, undefined);
            }
            break;
          }
        }

        if (!playerClicked) {
          // Check if click is on a point
          let pointClicked = false;
          let lineClicked = false;

          // Check if click is on a point of any line
          for (const line of lines) {
            // Helper function to check points in segments and branches
            const checkSegmentPoints = (
              segment: LineSegment,
              globalIndexRef: { value: number },
            ): boolean => {
              for (let i = 0; i < segment.points.length; i++) {
                const point = segment.points[i];
                const distance = Math.sqrt(
                  (x - point.x) ** 2 + (y - point.y) ** 2,
                );

                // Check if this is an arrowhead (last point of a segment with no branches)
                const isArrowhead =
                  i === segment.points.length - 1 &&
                  (!segment.branches || segment.branches.length === 0);
                // Use larger tolerance for arrowhead since it's harder to click
                const tolerance = isArrowhead ? 15 : 8;
                if (distance <= tolerance) {
                  // Click on point
                  setSelectedPoint({
                    lineId: line.id,
                    pointIndex: globalIndexRef.value,
                  });
                  setDraggingPoint(true);
                  // Set line ID but clear segment selection to show only the point is selected
                  setSelectedLineId(line.id);
                  setSelectedSegmentPath(null);
                  setSelectedPlayerId(null);
                  onPlayerSelect?.(null);
                  return true;
                }
                globalIndexRef.value++;
              }

              // Check branches
              if (segment.branches) {
                for (const branch of segment.branches) {
                  if (checkSegmentPoints(branch, globalIndexRef)) {
                    return true;
                  }
                }
              }

              return false;
            };

            const globalIndexRef = { value: 0 };
            for (const segment of line.segments) {
              if (checkSegmentPoints(segment, globalIndexRef)) {
                pointClicked = true;
                break;
              }
            }

            if (pointClicked) break;
          }

          if (!pointClicked) {
            // Check if click is on a line
            for (const line of lines) {
              const player = players.find((p) => p.id === line.playerId);
              if (!player) continue;

              // Helper function to check segments and branches recursively
              const checkSegmentHit = (
                segment: LineSegment,
                startPos: { x: number; y: number },
                segmentPath: number[],
              ): { hit: boolean; path: number[] } => {
                // Check line from start position to first point of segment
                if (segment.points.length > 0) {
                  const distance = pointToLineDistance(
                    x,
                    y,
                    startPos.x,
                    startPos.y,
                    segment.points[0].x,
                    segment.points[0].y,
                  );
                  if (distance < 5) {
                    return { hit: true, path: segmentPath };
                  }
                }

                // Check lines within the segment
                for (let i = 0; i < segment.points.length - 1; i++) {
                  const distance = pointToLineDistance(
                    x,
                    y,
                    segment.points[i].x,
                    segment.points[i].y,
                    segment.points[i + 1].x,
                    segment.points[i + 1].y,
                  );
                  if (distance < 5) {
                    return { hit: true, path: segmentPath };
                  }
                }

                // Get end position for checking branches
                const endPos =
                  segment.points.length > 0
                    ? segment.points[segment.points.length - 1]
                    : startPos;

                // Check branches
                if (segment.branches) {
                  for (
                    let branchIndex = 0;
                    branchIndex < segment.branches.length;
                    branchIndex++
                  ) {
                    const branchResult = checkSegmentHit(
                      segment.branches[branchIndex],
                      endPos,
                      [...segmentPath, branchIndex],
                    );
                    if (branchResult.hit) {
                      return branchResult;
                    }
                  }
                }

                return { hit: false, path: [] };
              };

              let currentPos = { x: player.x, y: player.y };

              for (
                let segmentIndex = 0;
                segmentIndex < line.segments.length;
                segmentIndex++
              ) {
                const segment = line.segments[segmentIndex];
                const result = checkSegmentHit(segment, currentPos, [
                  segmentIndex,
                ]);

                if (result.hit) {
                  setSelectedLineId(line.id);
                  setSelectedSegmentPath(result.path); // Set the full path to the selected segment
                  setDraggingLine(line.id);
                  setLineDragOffset({ x, y });
                  setSelectedPoint(null);
                  // Clear player selection when selecting a line
                  setSelectedPlayerId(null);
                  onPlayerSelect?.(null);
                  onLineSelect?.(line.id, lines, result.path);
                  lineClicked = true;
                  break;
                }

                // Update current position for next segment
                if (segment.points.length > 0) {
                  currentPos = segment.points[segment.points.length - 1];
                }
              }

              if (lineClicked) break;
            }
          }

          // If nothing was clicked (no player, line, or point), deselect
          if (!playerClicked && !lineClicked && !pointClicked) {
            setSelectedLineId(null);
            setSelectedSegmentPath(null);
            setSelectedPoint(null);
            setSelectedPlayerId(null);
            onPlayerSelect?.(null); // 親コンポーネントに通知
            onLineSelect?.(null, undefined, undefined);
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
      const playerRadius = footToPixel * 2; // 2フィート（約60cm）- ひと回り大きく

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
              // Helper function to recursively update points in segments and branches
              const updateSegmentPoint = (
                segment: LineSegment,
                globalIndexRef: { value: number },
              ): LineSegment => {
                const updatedPoints = segment.points.map((point) => {
                  if (globalIndexRef.value === selectedPoint.pointIndex) {
                    globalIndexRef.value++;
                    return { x, y }; // Move to mouse position
                  }
                  globalIndexRef.value++;
                  return point;
                });

                // Recursively update branches
                const updatedBranches = segment.branches
                  ? segment.branches.map((branch) =>
                      updateSegmentPoint(branch, globalIndexRef),
                    )
                  : undefined;

                return {
                  ...segment,
                  points: updatedPoints,
                  branches: updatedBranches,
                };
              };

              const globalIndexRef = { value: 0 };
              const newSegments = line.segments.map((segment) =>
                updateSegmentPoint(segment, globalIndexRef),
              );

              return { ...line, segments: newSegments };
            }
            return line;
          }),
        );
      } else if (draggingLine) {
        // Handle line dragging
        const dx = x - lineDragOffset.x;
        const dy = y - lineDragOffset.y;

        setLines((prevLines) =>
          prevLines.map((line) => {
            if (line.id === draggingLine) {
              // Helper function to recursively move all points in segments and branches
              const moveSegment = (segment: LineSegment): LineSegment => {
                const movedPoints = segment.points.map((point) => ({
                  x: point.x + dx,
                  y: point.y + dy,
                }));

                // Recursively move branches
                const movedBranches = segment.branches
                  ? segment.branches.map((branch) => moveSegment(branch))
                  : undefined;

                return {
                  ...segment,
                  points: movedPoints,
                  branches: movedBranches,
                };
              };

              return {
                ...line,
                segments: line.segments.map((segment) => moveSegment(segment)),
              };
            }
            return line;
          }),
        );

        setLineDragOffset({ x, y });
      }
    };

    const handleMouseUp = () => {
      setDraggingPlayer(null);
      setDraggingLine(null);
      setDraggingPoint(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPlayerId) {
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

    // 選手データを親コンポーネントに同期
    useEffect(() => {
      const updatePlayer = (playerId: string, updates: Partial<Player>) => {
        setPlayers((prevPlayers) =>
          prevPlayers.map((player) =>
            player.id === playerId ? { ...player, ...updates } : player,
          ),
        );
        onPlayerUpdate?.(playerId, updates);
      };

      // updatePlayerを外部から呼び出せるようにする
      (
        window as unknown as { _fieldUpdatePlayer?: typeof updatePlayer }
      )._fieldUpdatePlayer = updatePlayer;

      return () => {
        delete (window as unknown as { _fieldUpdatePlayer?: unknown })
          ._fieldUpdatePlayer;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onPlayerUpdate]);

    return (
      <canvas
        ref={canvasRef}
        className="shadow-lg"
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
              : draggingPlayer || draggingLine || draggingPoint
                ? 'grabbing'
                : hoveredPlayer
                  ? 'pointer'
                  : 'default',
        }}
      />
    );
  },
);

export { Field as default, type Player, type Line };
export type { FieldProps };
