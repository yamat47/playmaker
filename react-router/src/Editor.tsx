import type { KonvaEventObject } from "konva/lib/Node";
import {
	Stage,
	Layer,
	Arrow as KonvaArrow,
	Group,
	Circle,
	Line,
	Shape,
} from "react-konva";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayerNode } from "@/components/PlayerNode";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Layers, Move, TrendingUp, Trash2, User } from "lucide-react";

type Player = {
	id: string;
	type: "player";
	position: { x: number; y: number };
	label: string;
};

type StraightArrow = {
	id: string;
	type: "arrow";
	kind: "straight";
	parentId: string;
	relativeToParent: { x: number; y: number };
};

type CurveArrow = {
	id: string;
	type: "arrow";
	kind: "curve";
	parentId: string;
	relativeToParent: { x: number; y: number };
	controlPoint: { x: number; y: number };
};

type Arrow = StraightArrow | CurveArrow;

type Mode = "add-player" | "add-straight" | "add-curve" | "normal";

function App() {
	// 線追加確定処理・プレビュー用状態は不要
	const [elements, setElements] = useState<(Player | Arrow)[]>([]);
	const [mode, setMode] = useState<Mode>("normal");
	const [nextId, setNextId] = useState(1);
	// 線追加モード用の状態は不要
	const [arrowStartPlayerId, setArrowStartPlayerId] = useState<string | null>(
		null,
	);

	// 初期選手データをRails APIから取得
	useEffect(() => {
		fetch("/api/players")
			.then((res) => res.json())
			.then((players: Player[]) => {
				setElements(players);
				// nextIdを既存IDから決定
				const maxNum = players
					.map((p) => p.id)
					.filter((id) => /^P(\d+)$/.test(id))
					.map((id) => Number.parseInt(id.replace("P", ""), 10))
					.reduce((a, b) => Math.max(a, b), 0);
				setNextId(maxNum + 1);
			});
	}, []);
	const [selectedElementId, setSelectedElementId] = useState<string | null>(
		null,
	);

	const players = elements.filter((e): e is Player => e.type === "player");
	const arrows = elements.filter((e): e is Arrow => e.type === "arrow");

	const handlePlayerDragMove = (id: string, x: number, y: number) => {
		setElements((elements) =>
			elements.map((e) =>
				e.type === "player" && e.id === id ? { ...e, position: { x, y } } : e,
			),
		);
	};

	const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();
		if (!stage) return;
		const pointerPosition = stage.getPointerPosition();
		if (!pointerPosition) return;

		if (mode === "add-player") {
			const id = `P${nextId}`;
			setElements((elements) => [
				...elements,
				{
					id,
					type: "player",
					position: { x: pointerPosition.x, y: pointerPosition.y },
					label: id,
				},
			]);
			setNextId((n) => n + 1);
		} else if (
			(mode === "add-straight" || mode === "add-curve") &&
			arrowStartPlayerId
		) {
			// 始点が選手か線かで座標を取得
			let start: { x: number; y: number };
			const player = players.find((p) => p.id === arrowStartPlayerId);
			if (player) {
				start = player.position;
			} else {
				const arrow = arrows.find((a) => a.id === arrowStartPlayerId);
				if (!arrow) return;
				start = getArrowEnd(arrow);
			}
			const pt = { x: pointerPosition.x, y: pointerPosition.y };
			const relativeToParent = { x: pt.x - start.x, y: pt.y - start.y };
			const id = `A${Date.now()}`;
			if (mode === "add-straight") {
				setElements((elements) => [
					...elements,
					{
						id,
						type: "arrow",
						kind: "straight",
						parentId: arrowStartPlayerId,
						relativeToParent,
					},
				]);
				setArrowStartPlayerId(id);
			} else if (mode === "add-curve") {
				// 制御点は中間点
				const control = {
					x: (pt.x + start.x) / 2,
					y: (pt.y + start.y) / 2,
				};
				setElements((elements) => [
					...elements,
					{
						id,
						type: "arrow",
						kind: "curve",
						parentId: arrowStartPlayerId,
						relativeToParent,
						controlPoint: control,
					},
				]);
				// 曲線は一度追加したら通常モード（選択状態）に戻す
				setMode("normal");
				setSelectedElementId(id);
				setArrowStartPlayerId(null);
			}
		} else {
			setSelectedElementId(null);
		}
	};

	const handlePlayerClick = (id: string) => {
		if (
			mode === "add-player" ||
			mode === "add-straight" ||
			mode === "add-curve"
		)
			return;
		setSelectedElementId(id);
	};

	const handleArrowClick = (id: string) => {
		if (
			mode === "add-player" ||
			mode === "add-straight" ||
			mode === "add-curve"
		)
			return;
		setSelectedElementId(id);
	};

	const handleDeleteElement = () => {
		const collectDescendantIds = (
			targetId: string,
			elements: (Player | Arrow)[],
		): string[] => {
			const directChildren = elements.filter(
				(e) => "parentId" in e && e.parentId === targetId,
			);
			let allIds: string[] = [];
			for (const child of directChildren) {
				allIds.push(child.id);
				allIds = allIds.concat(collectDescendantIds(child.id, elements));
			}
			return allIds;
		};

		if (!selectedElementId) return;
		const element = elements.find((e) => e.id === selectedElementId);
		if (!element) return;

		const idsToDelete = [
			selectedElementId,
			...collectDescendantIds(selectedElementId, elements),
		];

		setElements((elements) =>
			elements.filter((e) => !idsToDelete.includes(e.id)),
		);
		setSelectedElementId(null);
	};

	const getArrowEnd = (arrow: Arrow): { x: number; y: number } => {
		const parent = elements.find((e) => e.id === arrow.parentId);

		let x = 0;
		let y = 0;

		if (!parent) return { x, y };

		if (parent.type === "player") {
			x = parent.position.x + arrow.relativeToParent.x;
			y = parent.position.y + arrow.relativeToParent.y;
		} else {
			const p = getArrowEnd(parent as Arrow);
			x = p.x + arrow.relativeToParent.x;
			y = p.y + arrow.relativeToParent.y;
		}

		return { x, y };
	};

	const collectAncestorArrowIds = (elementId: string): string[] => {
		let result: string[] = [];
		const element = elements.find((e) => e.id === elementId);

		if (element && "parentId" in element) {
			const parent = elements.find((e) => e.id === element.parentId);
			if (parent && parent.type === "arrow") {
				result = [parent.id, ...collectAncestorArrowIds(parent.id)];
			} else if (parent) {
				result = collectAncestorArrowIds(parent.id);
			}
		}

		return result;
	};

	const collectDescendantArrowIds = (elementId: string): string[] => {
		const directChildren = elements.filter(
			(e) => e.type === "arrow" && "parentId" in e && e.parentId === elementId,
		);
		let allIds: string[] = [];
		for (const child of directChildren) {
			allIds.push(child.id);
			allIds = allIds.concat(collectDescendantArrowIds(child.id));
		}
		return allIds;
	};

	const selectedElement = elements.find((e) => e.id === selectedElementId);
	const selectedPlayer =
		selectedElement?.type === "player" ? selectedElement : null;

	return (
		<div className="flex h-full bg-background">
			{/* 左カラム: 選手の追加・移動操作 */}
			<div className="w-64 bg-card border-r p-4 overflow-y-auto flex-shrink-0 custom-scrollbar">
				<div className="space-y-6">
					<div>
						<h2 className="text-lg font-semibold flex items-center gap-2">
							<Layers className="w-5 h-5" />
							ツール
						</h2>
					</div>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">モード</CardTitle>
							<CardDescription className="text-xs">
								編集モードを選択
							</CardDescription>
						</CardHeader>
						<CardContent>
							<RadioGroup
								value={mode}
								onValueChange={(value) => setMode(value as Mode)}
							>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="normal" id="normal" />
									<Label
										htmlFor="normal"
										className="text-sm font-normal cursor-pointer flex items-center gap-2"
									>
										<Move className="w-4 h-4" />
										選択・移動
									</Label>
								</div>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="add-player" id="add-player" />
									<Label
										htmlFor="add-player"
										className="text-sm font-normal cursor-pointer flex items-center gap-2"
									>
										<User className="w-4 h-4" />
										選手追加
									</Label>
								</div>
							</RadioGroup>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">矢印</CardTitle>
							<CardDescription className="text-xs">
								選手間の動きを表現
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							<Button
								className="w-full justify-start"
								onClick={() => {
									if (selectedElementId) {
										setMode("add-straight");
										setArrowStartPlayerId(selectedElementId);
									}
								}}
								disabled={!selectedElementId}
								variant={mode === "add-straight" ? "secondary" : "outline"}
								size="sm"
							>
								<TrendingUp className="w-4 h-4 mr-2" />
								直線を引く
							</Button>
							<Button
								className="w-full justify-start"
								onClick={() => {
									if (selectedElementId) {
										setMode("add-curve");
										setArrowStartPlayerId(selectedElementId);
									}
								}}
								disabled={!selectedElementId}
								variant={mode === "add-curve" ? "secondary" : "outline"}
								size="sm"
							>
								<svg
									className="w-4 h-4 mr-2"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-label="曲線アイコン"
								>
									<title>曲線アイコン</title>
									<path d="M5 12s2.545-5 7-5c4.454 0 7 5 7 5s-2.546 5-7 5c-4.455 0-7-5-7-5z" />
								</svg>
								曲線を引く
							</Button>
						</CardContent>
					</Card>

					<Separator />

					<Button
						className="w-full justify-start"
						onClick={handleDeleteElement}
						disabled={!selectedElementId}
						variant="destructive"
						size="sm"
					>
						<Trash2 className="w-4 h-4 mr-2" />
						{(() => {
							const element = elements.find((e) => e.id === selectedElementId);
							if (!element) return "削除";
							return element.type === "player" ? "選手を削除" : "矢印を削除";
						})()}
					</Button>
				</div>
			</div>

			{/* 中央カラム: フィールド */}
			<div className="flex-1 flex flex-col bg-background">
				{/* トップバー */}
				<div className="h-12 bg-card border-b flex items-center px-4 gap-4">
					<span className="text-sm font-medium text-muted-foreground">
						プレイエディター
					</span>
					<Separator orientation="vertical" className="h-6" />
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">
							フィールドサイズ:
						</span>
						<span className="text-xs font-mono">900 x 650</span>
					</div>
				</div>

				{/* キャンバスエリア */}
				<div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
					<div className="relative">
						{/* フィールドコンテナ */}
						<div className="bg-gradient-to-b from-green-800 to-green-900 p-4 rounded-lg shadow-2xl">
							{/* フィールドマーキング */}
							<svg
								width="900"
								height="650"
								className="absolute rounded"
								style={{ pointerEvents: "none" }}
								aria-label="アメリカンフットボールフィールド"
							>
								<title>アメリカンフットボールフィールド</title>
								{/* フィールドの背景 */}
								<rect
									x="0"
									y="0"
									width="900"
									height="650"
									fill="var(--field-green)"
									rx="4"
								/>

								{/* エンドゾーン */}
								<rect
									x="0"
									y="0"
									width="90"
									height="650"
									fill="var(--field-green-dark)"
								/>
								<rect
									x="810"
									y="0"
									width="90"
									height="650"
									fill="var(--field-green-dark)"
								/>

								{/* フィールド外枠 */}
								<rect
									x="0"
									y="0"
									width="900"
									height="650"
									fill="none"
									stroke="var(--field-line)"
									strokeWidth="4"
									rx="2"
								/>

								{/* ヤードライン（10ヤードごと） */}
								{[90, 180, 270, 360, 450, 540, 630, 720, 810].map((x, i) => (
									<g key={`yard-${x}`}>
										<line
											x1={x}
											y1="0"
											x2={x}
											y2="650"
											stroke="var(--field-line)"
											strokeWidth="3"
										/>
										{/* ヤード数表示 */}
										{i < 4 && (
											<>
												<text
													x={x + 45}
													y="30"
													fill="var(--field-line)"
													fontSize="24"
													fontWeight="bold"
													textAnchor="middle"
												>
													{(i + 1) * 10}
												</text>
												<text
													x={x + 45}
													y="630"
													fill="var(--field-line)"
													fontSize="24"
													fontWeight="bold"
													textAnchor="middle"
												>
													{(i + 1) * 10}
												</text>
											</>
										)}
										{i === 4 && (
											<>
												<text
													x={x}
													y="30"
													fill="var(--field-line)"
													fontSize="24"
													fontWeight="bold"
													textAnchor="middle"
												>
													50
												</text>
												<text
													x={x}
													y="630"
													fill="var(--field-line)"
													fontSize="24"
													fontWeight="bold"
													textAnchor="middle"
												>
													50
												</text>
											</>
										)}
										{i > 4 && (
											<>
												<text
													x={x - 45}
													y="30"
													fill="var(--field-line)"
													fontSize="24"
													fontWeight="bold"
													textAnchor="middle"
												>
													{(9 - i) * 10}
												</text>
												<text
													x={x - 45}
													y="630"
													fill="var(--field-line)"
													fontSize="24"
													fontWeight="bold"
													textAnchor="middle"
												>
													{(9 - i) * 10}
												</text>
											</>
										)}
									</g>
								))}

								{/* 5ヤードライン（薄い線） */}
								{[45, 135, 225, 315, 405, 495, 585, 675, 765, 855].map((x) => (
									<line
										key={`5yard-${x}`}
										x1={x}
										y1="0"
										x2={x}
										y2="650"
										stroke="var(--field-marking)"
										strokeWidth="1"
										strokeOpacity="0.4"
									/>
								))}

								{/* ハッシュマーク */}
								{[
									45, 90, 135, 180, 225, 270, 315, 360, 405, 450, 495, 540, 585,
									630, 675, 720, 765, 810, 855,
								].map((x) => (
									<g key={`hash-${x}`}>
										{/* 上部ハッシュマーク */}
										<line
											x1={x}
											y1="216"
											x2={x}
											y2="226"
											stroke="var(--field-marking)"
											strokeWidth="2"
										/>
										{/* 下部ハッシュマーク */}
										<line
											x1={x}
											y1="424"
											x2={x}
											y2="434"
											stroke="var(--field-marking)"
											strokeWidth="2"
										/>
									</g>
								))}

								{/* エンドゾーンのテキスト */}
								<text
									x="45"
									y="325"
									fill="var(--field-marking)"
									fontSize="32"
									fontWeight="bold"
									textAnchor="middle"
									transform="rotate(-90 45 325)"
								>
									END ZONE
								</text>
								<text
									x="855"
									y="325"
									fill="var(--field-marking)"
									fontSize="32"
									fontWeight="bold"
									textAnchor="middle"
									transform="rotate(90 855 325)"
								>
									END ZONE
								</text>
							</svg>

							{/* Konva Stage */}
							<Stage
								width={900}
								height={650}
								style={{ borderRadius: "4px" }}
								onClick={handleStageClick}
							>
								<Layer>
									{/* 追加中の線プレビュー */}

									{arrows.map((arrow) => {
										let fromX = 0;
										let fromY = 0;
										const parent = elements.find(
											(e) => e.id === arrow.parentId,
										);
										if (parent?.type === "player") {
											fromX = parent.position.x;
											fromY = parent.position.y;
										} else if (parent?.type === "arrow") {
											const p = getArrowEnd(parent as Arrow);
											fromX = p.x;
											fromY = p.y;
										}
										const toX = fromX + arrow.relativeToParent.x;
										const toY = fromY + arrow.relativeToParent.y;

										const isTerminal = !elements.some(
											(e) =>
												e.type === "arrow" &&
												"parentId" in e &&
												e.parentId === arrow.id,
										);

										if (arrow.kind === "curve") {
											const cpX = fromX + arrow.controlPoint.x;
											const cpY = fromY + arrow.controlPoint.y;

											const isTerminal = !elements.some(
												(e) =>
													e.type === "arrow" &&
													"parentId" in e &&
													e.parentId === arrow.id,
											);

											let curveEndX = toX;
											let curveEndY = toY;
											let arrowHeadProps = null;

											if (isTerminal) {
												const arrowHeadLength = 16;
												const dx = 2 * (toX - cpX);
												const dy = 2 * (toY - cpY);
												const angle = Math.atan2(dy, dx);
												const offset = arrowHeadLength * 0.7;
												curveEndX = toX - offset * Math.cos(angle);
												curveEndY = toY - offset * Math.sin(angle);
												arrowHeadProps = {
													from: { x: fromX, y: fromY },
													cp: { x: cpX, y: cpY },
													to: { x: toX, y: toY },
													headBase: { x: curveEndX, y: curveEndY },
													color:
														selectedElementId === arrow.id
															? "var(--arrow-selected)"
															: "var(--arrow-color)",
													onClick: (e: KonvaEventObject<MouseEvent>) => {
														e.cancelBubble = true;
														handleArrowClick(arrow.id);
													},
												};
											}

											return (
												<React.Fragment key={arrow.id}>
													<Shape
														sceneFunc={(ctx, shape) => {
															ctx.beginPath();
															ctx.moveTo(fromX, fromY);
															ctx.bezierCurveTo(
																cpX,
																cpY,
																cpX,
																cpY,
																curveEndX,
																curveEndY,
															);
															ctx.strokeShape(shape);
														}}
														stroke={
															selectedElementId === arrow.id
																? "var(--arrow-selected)"
																: "var(--arrow-color)"
														}
														strokeWidth={4}
														hitStrokeWidth={20}
														onClick={(e) => {
															e.cancelBubble = true;
															handleArrowClick(arrow.id);
														}}
													/>
													{isTerminal && arrowHeadProps && (
														<ArrowHead {...arrowHeadProps} />
													)}
												</React.Fragment>
											);
										}

										return isTerminal ? (
											<KonvaArrow
												key={arrow.id}
												points={[fromX, fromY, toX, toY]}
												pointerLength={16}
												pointerWidth={16}
												fill={
													selectedElementId === arrow.id
														? "var(--arrow-selected)"
														: "var(--arrow-color)"
												}
												stroke={
													selectedElementId === arrow.id
														? "var(--arrow-selected)"
														: "var(--arrow-color)"
												}
												strokeWidth={4}
												onClick={(e) => {
													e.cancelBubble = true;
													handleArrowClick(arrow.id);
												}}
											/>
										) : (
											<Line
												key={arrow.id}
												points={[fromX, fromY, toX, toY]}
												stroke={
													selectedElementId === arrow.id
														? "var(--arrow-selected)"
														: "var(--arrow-color)"
												}
												strokeWidth={4}
												onClick={(e) => {
													e.cancelBubble = true;
													handleArrowClick(arrow.id);
												}}
											/>
										);
									})}
									{arrows.map((arrow) => {
										let fromX = 0;
										let fromY = 0;
										const parent = elements.find(
											(e) => e.id === arrow.parentId,
										);
										if (parent?.type === "player") {
											fromX = parent.position.x;
											fromY = parent.position.y;
										} else if (parent?.type === "arrow") {
											const p = getArrowEnd(parent as Arrow);
											fromX = p.x;
											fromY = p.y;
										}
										const toX = fromX + arrow.relativeToParent.x;
										const toY = fromY + arrow.relativeToParent.y;

										const circleRadius = 8;

										let showCircle = false;
										if (selectedElementId) {
											const ancestorIds =
												collectAncestorArrowIds(selectedElementId);
											const descendantIds =
												collectDescendantArrowIds(selectedElementId);
											showCircle =
												selectedElementId === arrow.id ||
												ancestorIds.includes(arrow.id) ||
												descendantIds.includes(arrow.id);
										}

										const isTerminal = !elements.some(
											(e) =>
												e.type === "arrow" &&
												"parentId" in e &&
												e.parentId === arrow.id,
										);

										return (
											<Circle
												key={`${arrow.id}-end`}
												x={toX}
												y={toY}
												radius={circleRadius}
												draggable
												onMouseDown={(e) => {
													e.cancelBubble = true;
												}}
												onDragMove={(e) => {
													const stage = e.target.getStage();
													if (!stage) return;
													const pointer = stage.getPointerPosition();
													if (!pointer) return;
													const newRelX = pointer.x - fromX;
													const newRelY = pointer.y - fromY;
													setElements((elements) =>
														elements.map((el) =>
															el.id === arrow.id && el.type === "arrow"
																? {
																		...el,
																		relativeToParent: {
																			x: newRelX,
																			y: newRelY,
																		},
																	}
																: el,
														),
													);
												}}
												onClick={(e) => {
													e.cancelBubble = true;
													handleArrowClick(arrow.id);
												}}
												visible={showCircle}
												cursor="pointer"
												stroke={
													isTerminal ? "transparent" : "var(--arrow-selected)"
												}
												strokeWidth={2}
												fill={isTerminal ? "transparent" : "#fff"}
												listening={true}
											/>
										);
									})}
									{arrows.map((arrow) => {
										if (arrow.kind !== "curve") return null;
										let fromX = 0;
										let fromY = 0;
										const parent = elements.find(
											(e) => e.id === arrow.parentId,
										);
										if (parent?.type === "player") {
											fromX = parent.position.x;
											fromY = parent.position.y;
										} else if (parent?.type === "arrow") {
											const p = getArrowEnd(parent as Arrow);
											fromX = p.x;
											fromY = p.y;
										}
										const cpX = fromX + arrow.controlPoint.x;
										const cpY = fromY + arrow.controlPoint.y;

										let showCircle = false;
										if (selectedElementId) {
											const ancestorIds =
												collectAncestorArrowIds(selectedElementId);
											const descendantIds =
												collectDescendantArrowIds(selectedElementId);
											showCircle =
												selectedElementId === arrow.id ||
												ancestorIds.includes(arrow.id) ||
												descendantIds.includes(arrow.id);
										}

										return (
											<Circle
												key={`${arrow.id}-cp`}
												x={cpX}
												y={cpY}
												radius={7}
												draggable
												onMouseDown={(e) => {
													e.cancelBubble = true;
												}}
												onDragMove={(e) => {
													const stage = e.target.getStage();
													if (!stage) return;
													const pointer = stage.getPointerPosition();
													if (!pointer) return;
													const newCpX = pointer.x - fromX;
													const newCpY = pointer.y - fromY;
													setElements((elements) =>
														elements.map((el) =>
															el.id === arrow.id &&
															el.type === "arrow" &&
															el.kind === "curve"
																? {
																		...el,
																		controlPoint: { x: newCpX, y: newCpY },
																	}
																: el,
														),
													);
												}}
												visible={showCircle}
												cursor="pointer"
												stroke="var(--accent-foreground)"
												strokeWidth={2}
												fill="#fff"
												listening={true}
											/>
										);
									})}
									{players.map((player) => (
										<Group
											key={player.id}
											x={player.position.x}
											y={player.position.y}
											draggable={mode !== "add-player"}
											onDragMove={(e) => {
												const { x, y } = e.target.position();
												handlePlayerDragMove(player.id, x, y);
											}}
											onClick={(e) => {
												e.cancelBubble = true;
												handlePlayerClick(player.id);
											}}
										>
											<PlayerNode
												{...player}
												x={0}
												y={0}
												isSelected={selectedElementId === player.id}
											/>
										</Group>
									))}
								</Layer>
							</Stage>
						</div>
					</div>
				</div>
			</div>

			{/* 右カラム: プロパティパネル */}
			<div className="w-80 bg-card border-l flex-shrink-0">
				{selectedPlayer ? (
					<div className="h-full flex flex-col">
						{/* ヘッダー */}
						<div className="h-12 border-b px-4 flex items-center">
							<h3 className="text-sm font-medium">プロパティ</h3>
						</div>

						{/* コンテンツ */}
						<div className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
							<div className="space-y-4">
								<div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
									<div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
										{selectedPlayer.label}
									</div>
									<div>
										<p className="text-sm font-medium">
											選手 {selectedPlayer.id}
										</p>
										<p className="text-xs text-muted-foreground">
											オフェンスチーム
										</p>
									</div>
								</div>

								<Separator />

								<div className="space-y-3">
									<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
										基本情報
									</h4>
									<div className="space-y-3">
										<div>
											<Label htmlFor="player-name" className="text-xs">
												名前
											</Label>
											<Input
												id="player-name"
												value={selectedPlayer.label}
												className="h-8 mt-1"
												readOnly
											/>
										</div>
										<div>
											<Label htmlFor="player-role" className="text-xs">
												ポジション
											</Label>
											<select
												id="player-role"
												className="w-full h-8 mt-1 px-3 rounded-md border bg-background text-sm"
											>
												<optgroup label="オフェンス">
													<option>QB - クォーターバック</option>
													<option>RB - ランニングバック</option>
													<option>FB - フルバック</option>
													<option>WR - ワイドレシーバー</option>
													<option>TE - タイトエンド</option>
													<option>C - センター</option>
													<option>G - ガード</option>
													<option>T - タックル</option>
												</optgroup>
												<optgroup label="ディフェンス">
													<option>DE - ディフェンシブエンド</option>
													<option>DT - ディフェンシブタックル</option>
													<option>LB - ラインバッカー</option>
													<option>CB - コーナーバック</option>
													<option>S - セーフティ</option>
												</optgroup>
											</select>
										</div>
									</div>
								</div>

								<Separator />

								<div className="space-y-3">
									<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
										位置情報
									</h4>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label htmlFor="pos-x" className="text-xs">
												X座標
											</Label>
											<div className="flex items-center gap-2 mt-1">
												<Input
													id="pos-x"
													type="number"
													value={Math.round(selectedPlayer.position.x)}
													className="h-8"
													readOnly
												/>
												<span className="text-xs text-muted-foreground">
													px
												</span>
											</div>
										</div>
										<div>
											<Label htmlFor="pos-y" className="text-xs">
												Y座標
											</Label>
											<div className="flex items-center gap-2 mt-1">
												<Input
													id="pos-y"
													type="number"
													value={Math.round(selectedPlayer.position.y)}
													className="h-8"
													readOnly
												/>
												<span className="text-xs text-muted-foreground">
													px
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="h-full flex flex-col">
						<div className="h-12 border-b px-4 flex items-center">
							<h3 className="text-sm font-medium">プロパティ</h3>
						</div>
						<div className="flex-1 flex items-center justify-center p-8">
							<p className="text-sm text-muted-foreground text-center">
								選手または矢印を選択してください
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function ArrowHead({
	to,
	headBase,
	color,
	onClick,
}: {
	from: { x: number; y: number };
	cp: { x: number; y: number };
	to: { x: number; y: number };
	headBase: { x: number; y: number };
	color: string;
	onClick?: (e: KonvaEventObject<MouseEvent>) => void;
}) {
	// headBase→to方向の角度
	const dx = to.x - headBase.x;
	const dy = to.y - headBase.y;
	const angle = Math.atan2(dy, dx);

	const len = 16;
	const tip = { x: to.x, y: to.y };
	const left = {
		x: to.x - len * Math.cos(angle - Math.PI / 7),
		y: to.y - len * Math.sin(angle - Math.PI / 7),
	};
	const right = {
		x: to.x - len * Math.cos(angle + Math.PI / 7),
		y: to.y - len * Math.sin(angle + Math.PI / 7),
	};

	return (
		<Shape
			sceneFunc={(ctx, shape) => {
				ctx.beginPath();
				ctx.moveTo(tip.x, tip.y);
				ctx.lineTo(left.x, left.y);
				ctx.lineTo(right.x, right.y);
				ctx.closePath();
				ctx.fillStrokeShape(shape);
			}}
			fill={color}
			stroke={color}
			strokeWidth={1}
			hitStrokeWidth={20}
			onClick={onClick}
		/>
	);
}

export default App;
