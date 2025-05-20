import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer, Arrow, Group } from "react-konva";
import { useState } from "react";
import { PlayerNode } from "./components/PlayerNode";

type Player = {
	id: string;
	x: number;
	y: number;
	label: string;
};

type Mode = "add" | "normal";

type ArrowType = {
	id: string;
	fromPlayerId: string;
};

function App() {
	const [players, setPlayers] = useState<Player[]>([
		{ id: "X", x: 100, y: 100, label: "X" },
		{ id: "Z", x: 300, y: 100, label: "Z" },
	]);
	const [arrows, setArrows] = useState<ArrowType[]>([]);
	const [mode, setMode] = useState<Mode>("normal");
	const [nextId, setNextId] = useState(1);
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
	const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);

	const handleGroupDragMove = (id: string, x: number, y: number) => {
		setPlayers((players) =>
			players.map((p) => (p.id === id ? { ...p, x, y } : p)),
		);
	};

	const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
		const stage = e.target.getStage();

		if (!stage) return;

		const pointerPosition = stage.getPointerPosition();

		if (!pointerPosition) return;

		if (mode === "add") {
			const id = `P${nextId}`;
			setPlayers((players) => [
				...players,
				{
					id,
					x: pointerPosition.x,
					y: pointerPosition.y,
					label: id,
				},
			]);
			setNextId((n) => n + 1);
		} else {
			setSelectedPlayerId(null);
			setSelectedArrowId(null);
		}
	};

	const handlePlayerClick = (id: string) => {
		if (mode === "add") return;
		setSelectedPlayerId(id);
		setSelectedArrowId(null);
	};

	const handleArrowClick = (id: string) => {
		setSelectedArrowId(id);
		setSelectedPlayerId(null);
	};

	const handleDeletePlayer = () => {
		if (!selectedPlayerId) return;
		setPlayers((players) =>
			players.filter((player) => player.id !== selectedPlayerId),
		);
		setArrows((arrows) =>
			arrows.filter((arrow) => arrow.fromPlayerId !== selectedPlayerId),
		);
		setSelectedPlayerId(null);
	};

	const handleAddArrow = () => {
		if (!selectedPlayerId) return;
		const arrowId = `A${Date.now()}`;
		setArrows((arrows) => [
			...arrows,
			{ id: arrowId, fromPlayerId: selectedPlayerId },
		]);
		setSelectedArrowId(arrowId);
		setSelectedPlayerId(null);
	};

	const handleDeleteArrow = () => {
		if (!selectedArrowId) return;
		setArrows((arrows) => arrows.filter((a) => a.id !== selectedArrowId));
		setSelectedArrowId(null);
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
					onClick={handleDeletePlayer}
					disabled={!selectedPlayerId}
				>
					選手削除
				</button>
				<button
					type="button"
					style={{ marginLeft: 16 }}
					onClick={handleAddArrow}
					disabled={!selectedPlayerId}
				>
					矢印追加
				</button>
				<button
					type="button"
					style={{ marginLeft: 16 }}
					onClick={handleDeleteArrow}
					disabled={!selectedArrowId}
				>
					矢印削除
				</button>
			</div>
			<Stage
				width={800}
				height={600}
				style={{ background: "#f3f3f3" }}
				onClick={handleStageClick}
			>
				<Layer>
					{players.map((player) => {
						const playerArrows = arrows.filter(
							(a) => a.fromPlayerId === player.id,
						);
						return (
							<Group
								key={player.id}
								x={player.x}
								y={player.y}
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
								{playerArrows.map((arrow) => (
									<Arrow
										key={arrow.id}
										points={[0, 0, 80, 0]}
										pointerLength={16}
										pointerWidth={16}
										fill={selectedArrowId === arrow.id ? "#3498db" : "#888"}
										stroke={selectedArrowId === arrow.id ? "#3498db" : "#888"}
										strokeWidth={4}
										onClick={(e) => {
											e.cancelBubble = true;
											handleArrowClick(arrow.id);
										}}
									/>
								))}
								<PlayerNode
									{...player}
									x={0}
									y={0}
									isSelected={selectedPlayerId === player.id}
								/>
							</Group>
						);
					})}
				</Layer>
			</Stage>
		</div>
	);
}

export default App;
