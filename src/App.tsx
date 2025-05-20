import type { KonvaEventObject } from "konva/lib/Node";
import { Stage, Layer } from "react-konva";
import { useState } from "react";
import { PlayerNode } from "./components/PlayerNode";

type Player = {
	id: string;
	x: number;
	y: number;
	label: string;
};

type Mode = "add" | "normal";

function App() {
	const [players, setPlayers] = useState<Player[]>([
		{ id: "X", x: 100, y: 100, label: "X" },
		{ id: "Z", x: 300, y: 100, label: "Z" },
	]);
	const [mode, setMode] = useState<Mode>("normal");
	const [nextId, setNextId] = useState(1);
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

	const handleDragMove = (id: string, x: number, y: number) => {
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
		}
	};

	const handlePlayerClick = (id: string) => {
		console.log("Player clicked:", id);
		if (mode === "add") return;

		setSelectedPlayerId(id);
	};

	const handleDeletePlayer = () => {
		if (!selectedPlayerId) return;

		setPlayers((players) =>
			players.filter((player) => player.id !== selectedPlayerId),
		);
		setSelectedPlayerId(null);
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
			</div>
			<Stage
				width={800}
				height={600}
				style={{ background: "#f3f3f3" }}
				onClick={handleStageClick}
			>
				<Layer>
					{players.map((player) => (
						<PlayerNode
							key={player.id}
							{...player}
							onDragMove={handleDragMove}
							onClick={(e) => {
								e.cancelBubble = true;
								handlePlayerClick(player.id);
							}}
							isSelected={selectedPlayerId === player.id}
						/>
					))}
				</Layer>
			</Stage>
		</div>
	);
}

export default App;
