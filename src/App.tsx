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
import React, { useState } from "react";
import { PlayerNode } from "./components/PlayerNode";

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

type Mode = "add" | "normal";

function App() {
	const [elements, setElements] = useState<(Player | Arrow)[]>([
		{ id: "X", type: "player", position: { x: 100, y: 100 }, label: "X" },
		{ id: "Z", type: "player", position: { x: 300, y: 100 }, label: "Z" },
	]);
	const [mode, setMode] = useState<Mode>("normal");
	const [nextId, setNextId] = useState(1);
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

		if (mode === "add") {
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
		} else {
			setSelectedElementId(null);
		}
	};

	const handlePlayerClick = (id: string) => {
		if (mode === "add") return;
		setSelectedElementId(id);
	};

	const handleArrowClick = (id: string) => {
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

	const handleAddStraight = () => {
		if (!selectedElementId) return;
		const selected = elements.find((e) => e.id === selectedElementId);
		if (!selected) return;
		const parentId = selected.id;
		const arrowId = `A${Date.now()}`;
		setElements((elements) => [
			...elements,
			{
				id: arrowId,
				type: "arrow",
				kind: "straight",
				parentId,
				relativeToParent: { x: 80, y: 0 },
			} as StraightArrow,
		]);
		setSelectedElementId(arrowId);
	};

	const handleAddCurve = () => {
		if (!selectedElementId) return;
		const selected = elements.find((e) => e.id === selectedElementId);
		if (!selected) return;
		const parentId = selected.id;
		const arrowId = `A${Date.now()}`;
		setElements((elements) => [
			...elements,
			{
				id: arrowId,
				type: "arrow",
				kind: "curve",
				parentId,
				relativeToParent: { x: 80, y: 0 },
				controlPoint: { x: 40, y: -40 },
			} as CurveArrow,
		]);
		setSelectedElementId(arrowId);
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

	return (
		<div>
			<div style={{ marginBottom: 8 }}>
				<label>
					<input
						type="radio"
						value="normal"
						checked={mode === "normal"}
						onChange={() => setMode("normal")}
					/>
					通常モード
				</label>
				<label>
					<input
						type="radio"
						value="add"
						checked={mode === "add"}
						onChange={() => setMode("add")}
					/>
					選手追加モード
				</label>
				<button
					type="button"
					style={{ marginLeft: 16 }}
					onClick={handleDeleteElement}
					disabled={!selectedElementId}
				>
					{(() => {
						const element = elements.find((e) => e.id === selectedElementId);
						if (!element) return "削除";
						return element.type === "player" ? "選手削除" : "矢印削除";
					})()}
				</button>
				<button
					type="button"
					style={{ marginLeft: 16 }}
					onClick={handleAddStraight}
					disabled={!selectedElementId}
				>
					直線追加
				</button>
				<button
					type="button"
					style={{ marginLeft: 8 }}
					onClick={handleAddCurve}
					disabled={!selectedElementId}
				>
					曲線追加
				</button>
			</div>
			<Stage
				width={800}
				height={600}
				style={{ background: "#f3f3f3" }}
				onClick={handleStageClick}
			>
				<Layer>
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
							draggable={mode !== "add"}
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
	);
}

function ArrowHead({
	from,
	cp,
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
	const width = 16;
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
