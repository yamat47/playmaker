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
	const selectedPlayer = selectedElement?.type === "player" ? selectedElement : null;

	return (
		<div className="flex h-screen bg-gray-50">
			{/* 左カラム: 選手の追加・移動操作 */}
			<div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto flex-shrink-0">
				<h2 className="text-lg font-semibold mb-4">操作パネル</h2>
				
				<div className="space-y-4">
					<div>
						<h3 className="text-sm font-medium mb-2">モード選択</h3>
						<div className="space-y-2">
							<label className="flex items-center">
								<input
									type="radio"
									value="normal"
									checked={mode === "normal"}
									onChange={() => setMode("normal")}
									className="mr-2"
								/>
								通常モード
							</label>
							<label className="flex items-center">
								<input
									type="radio"
									value="add-player"
									checked={mode === "add-player"}
									onChange={() => setMode("add-player")}
									className="mr-2"
								/>
								選手追加
							</label>
						</div>
					</div>

					<div>
						<h3 className="text-sm font-medium mb-2">矢印操作</h3>
						<div className="space-y-2">
							<Button
								className="w-full"
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
								選択中から直線を引く
							</Button>
							<Button
								className="w-full"
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
								選択中から曲線を引く
							</Button>
						</div>
					</div>

					<div>
						<h3 className="text-sm font-medium mb-2">削除</h3>
						<Button
							className="w-full"
							onClick={handleDeleteElement}
							disabled={!selectedElementId}
							variant="destructive"
							size="sm"
						>
							{(() => {
								const element = elements.find((e) => e.id === selectedElementId);
								if (!element) return "削除";
								return element.type === "player" ? "選手削除" : "矢印削除";
							})()}
						</Button>
					</div>
				</div>
			</div>

			{/* 中央カラム: フィールド */}
			<div className="flex-1 flex items-center justify-center p-4 min-w-0">
				<div className="bg-white rounded-lg shadow-lg">
					<Stage
						width={900}
						height={650}
						style={{ background: "#f3f3f3" }}
						onClick={handleStageClick}
					>
				<Layer>
					{/* 追加中の線プレビュー */}

					{arrows.map((arrow) => {
						let fromX = 0;
						let fromY = 0;
						const parent = elements.find((e) => e.id === arrow.parentId);
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
									color: selectedElementId === arrow.id ? "#3498db" : "#888",
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
										stroke={selectedElementId === arrow.id ? "#3498db" : "#888"}
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
								fill={selectedElementId === arrow.id ? "#3498db" : "#888"}
								stroke={selectedElementId === arrow.id ? "#3498db" : "#888"}
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
								stroke={selectedElementId === arrow.id ? "#3498db" : "#888"}
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
						const parent = elements.find((e) => e.id === arrow.parentId);
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
							const ancestorIds = collectAncestorArrowIds(selectedElementId);
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
														relativeToParent: { x: newRelX, y: newRelY },
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
								stroke={isTerminal ? "transparent" : "#3498db"}
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
						const parent = elements.find((e) => e.id === arrow.parentId);
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
							const ancestorIds = collectAncestorArrowIds(selectedElementId);
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
								stroke="#e67e22"
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

			{/* 右カラム: 選択中の選手情報 */}
			<div className="w-64 bg-white border-l border-gray-200 p-4 flex-shrink-0">
				{selectedPlayer && (
					<>
						<h2 className="text-lg font-semibold mb-4">選手情報</h2>
						<div className="space-y-3">
							<div>
								<label className="text-sm font-medium text-gray-700">ID</label>
								<p className="text-lg">{selectedPlayer.id}</p>
							</div>
							<div>
								<label className="text-sm font-medium text-gray-700">ラベル</label>
								<p className="text-lg">{selectedPlayer.label}</p>
							</div>
							<div>
								<label className="text-sm font-medium text-gray-700">位置</label>
								<p className="text-lg">
									X: {Math.round(selectedPlayer.position.x)}, Y: {Math.round(selectedPlayer.position.y)}
								</p>
							</div>
						</div>
					</>
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
