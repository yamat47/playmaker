import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Arrow, Group, Circle, Line } from "react-konva";
import { useState } from "react";
import { PlayerNode } from "./components/PlayerNode";

type GraphNode =
	| {
			id: string;
			type: "player";
			position: { x: number; y: number };
			label: string;
	  }
	| {
			id: string;
			type: "arrow";
			parentId: string;
			relativeToParent: { x: number; y: number };
	  };

type Mode = "add" | "normal";

function App() {
	const [nodes, setNodes] = useState<GraphNode[]>([
		{ id: "X", type: "player", position: { x: 100, y: 100 }, label: "X" },
		{ id: "Z", type: "player", position: { x: 300, y: 100 }, label: "Z" },
	]);
	const [mode, setMode] = useState<Mode>("normal");
	const [nextId, setNextId] = useState(1);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

	const players = nodes.filter(
		(n): n is Extract<GraphNode, { type: "player" }> => n.type === "player",
	);
	const arrows = nodes.filter(
		(n): n is Extract<GraphNode, { type: "arrow" }> => n.type === "arrow",
	);

	const handleGroupDragMove = (id: string, x: number, y: number) => {
		setNodes((nodes) =>
			nodes.map((n) =>
				n.type === "player" && n.id === id ? { ...n, position: { x, y } } : n,
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
			setNodes((nodes) => [
				...nodes,
				{
					id,
					type: "player",
					position: { x: pointerPosition.x, y: pointerPosition.y },
					label: id,
				},
			]);
			setNextId((n) => n + 1);
		} else {
			setSelectedNodeId(null);
		}
	};

	const handlePlayerClick = (id: string) => {
		if (mode === "add") return;
		setSelectedNodeId(id);
	};

	const handleArrowClick = (id: string) => {
		setSelectedNodeId(id);
	};

	const handleDeleteNode = () => {
		const collectDescendantIds = (
			targetId: string,
			nodes: GraphNode[],
		): string[] => {
			const directChildren = nodes.filter(
				(n) => "parentId" in n && n.parentId === targetId,
			);
			let allIds: string[] = [];
			for (const child of directChildren) {
				allIds.push(child.id);
				allIds = allIds.concat(collectDescendantIds(child.id, nodes));
			}
			return allIds;
		};

		if (!selectedNodeId) return;
		const node = nodes.find((n) => n.id === selectedNodeId);
		if (!node) return;

		const idsToDelete = [
			selectedNodeId,
			...collectDescendantIds(selectedNodeId, nodes),
		];

		setNodes((nodes) => nodes.filter((n) => !idsToDelete.includes(n.id)));
		setSelectedNodeId(null);
	};

	const handleAddArrow = () => {
		if (!selectedNodeId) return;
		const selectedNode = nodes.find((n) => n.id === selectedNodeId);
		if (!selectedNode) return;
		const parentId = selectedNode.id;
		const arrowId = `A${Date.now()}`;
		setNodes((nodes) => [
			...nodes,
			{
				id: arrowId,
				type: "arrow",
				parentId,
				// TODO: manually set the relativeToParent
				relativeToParent: { x: 80, y: 0 },
			},
		]);
		setSelectedNodeId(arrowId);
	};

	const getArrowEnd = (
		arrowNode: Extract<GraphNode, { type: "arrow" }>,
	): { x: number; y: number } => {
		const parent = nodes.find((n) => n.id === arrowNode.parentId);

		let x = 0;
		let y = 0;

		if (!parent) return { x, y };

		if (parent.type === "player") {
			x = parent.position.x + arrowNode.relativeToParent.x;
			y = parent.position.y + arrowNode.relativeToParent.y;
		} else {
			const p = getArrowEnd(parent);

			x = p.x + arrowNode.relativeToParent.x;
			y = p.y + arrowNode.relativeToParent.y;
		}

		return { x, y };
	};

	const collectAncestorArrowIds = (nodeId: string): string[] => {
		let result: string[] = [];
		const node = nodes.find((n) => n.id === nodeId);

		if (node && "parentId" in node) {
			const parent = nodes.find((n) => n.id === node.parentId);
			if (parent && parent.type === "arrow") {
				result = [parent.id, ...collectAncestorArrowIds(parent.id)];
			} else if (parent) {
				result = collectAncestorArrowIds(parent.id);
			}
		}

		return result;
	};

	const collectDescendantArrowIds = (nodeId: string): string[] => {
		const directChildren = nodes.filter(
			(n) => n.type === "arrow" && "parentId" in n && n.parentId === nodeId,
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
					onClick={handleDeleteNode}
					disabled={!selectedNodeId}
				>
					{(() => {
						const node = nodes.find((n) => n.id === selectedNodeId);
						if (!node) return "削除";
						return node.type === "player" ? "選手削除" : "矢印削除";
					})()}
				</button>
				<button
					type="button"
					style={{ marginLeft: 16 }}
					onClick={handleAddArrow}
					disabled={!selectedNodeId}
				>
					矢印追加
				</button>
			</div>
			<Stage
				width={800}
				height={600}
				style={{ background: "#f3f3f3" }}
				onClick={handleStageClick}
			>
				<Layer>
					{/* まずArrow/Lineのみ描画 */}
					{arrows.map((arrow) => {
						let fromX = 0;
						let fromY = 0;
						const parent = nodes.find((n) => n.id === arrow.parentId);
						if (parent?.type === "player") {
							fromX = parent.position.x;
							fromY = parent.position.y;
						} else if (parent?.type === "arrow") {
							const p = getArrowEnd(parent);
							fromX = p.x;
							fromY = p.y;
						}
						const toX = fromX + arrow.relativeToParent.x;
						const toY = fromY + arrow.relativeToParent.y;

						const isTerminal = !nodes.some(
							(n) =>
								n.type === "arrow" &&
								"parentId" in n &&
								n.parentId === arrow.id,
						);

						return isTerminal ? (
							<Arrow
								key={arrow.id}
								points={[fromX, fromY, toX, toY]}
								pointerLength={16}
								pointerWidth={16}
								fill={selectedNodeId === arrow.id ? "#3498db" : "#888"}
								stroke={selectedNodeId === arrow.id ? "#3498db" : "#888"}
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
								stroke={selectedNodeId === arrow.id ? "#3498db" : "#888"}
								strokeWidth={4}
								onClick={(e) => {
									e.cancelBubble = true;
									handleArrowClick(arrow.id);
								}}
							/>
						);
					})}
					{/* 次にCircleのみ描画 */}
					{arrows.map((arrow) => {
						let fromX = 0;
						let fromY = 0;
						const parent = nodes.find((n) => n.id === arrow.parentId);
						if (parent?.type === "player") {
							fromX = parent.position.x;
							fromY = parent.position.y;
						} else if (parent?.type === "arrow") {
							const p = getArrowEnd(parent);
							fromX = p.x;
							fromY = p.y;
						}
						const toX = fromX + arrow.relativeToParent.x;
						const toY = fromY + arrow.relativeToParent.y;

						const circleRadius = 8;

						let showCircle = false;
						if (selectedNodeId) {
							const ancestorIds = collectAncestorArrowIds(selectedNodeId);
							const descendantIds = collectDescendantArrowIds(selectedNodeId);
							showCircle =
								selectedNodeId === arrow.id ||
								ancestorIds.includes(arrow.id) ||
								descendantIds.includes(arrow.id);
						}

						const isTerminal = !nodes.some(
							(n) =>
								n.type === "arrow" &&
								"parentId" in n &&
								n.parentId === arrow.id,
						);

						return (
							<Circle
								key={arrow.id}
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
									setNodes((nodes) =>
										nodes.map((n) =>
											n.id === arrow.id && n.type === "arrow"
												? {
														...n,
														relativeToParent: { x: newRelX, y: newRelY },
													}
												: n,
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
								handleGroupDragMove(player.id, x, y);
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
								isSelected={selectedNodeId === player.id}
							/>
						</Group>
					))}
				</Layer>
			</Stage>
		</div>
	);
}

export default App;
