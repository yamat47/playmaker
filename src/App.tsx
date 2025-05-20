import type { KonvaEventObject } from "konva/lib/Node";
import {
	Stage,
	Layer,
	Arrow as KonvaArrow,
	Group,
	Circle,
	Line,
} from "react-konva";
import { useState } from "react";
import { PlayerNode } from "./components/PlayerNode";

type Player = {
	id: string;
	type: "player";
	position: { x: number; y: number };
	label: string;
};

type Arrow = {
	id: string;
	type: "arrow";
	kind: "straight";
	parentId: string;
	relativeToParent: { x: number; y: number };
};

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
			},
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
			</div>
			<Stage
				width={800}
				height={600}
				style={{ background: "#f3f3f3" }}
				onClick={handleStageClick}
			>
				<Layer>
					{/* 矢印（直線のみ）描画 */}
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
					{/* 終端Circle描画（直線のみ） */}
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

export default App;
