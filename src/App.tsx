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

type Mode = "add" | "move" | "delete";

function App() {
	const [players, setPlayers] = useState<Player[]>([
		{ id: "X", x: 100, y: 100, label: "X" },
		{ id: "Z", x: 300, y: 100, label: "Z" },
	]);
	const [mode, setMode] = useState<Mode>("move");
	const [nextId, setNextId] = useState(1);

	const handleDragMove = (id: string, x: number, y: number) => {
		if (mode !== "move") return;
		setPlayers((players) =>
			players.map((p) => (p.id === id ? { ...p, x, y } : p)),
		);
	};

	const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
		if (mode !== "add") return;
		const stage = e.target.getStage();

		if (!stage) return;

		const pointerPosition = stage.getPointerPosition();
		if (!pointerPosition) return;
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
	};

	const handlePlayerClick = (id: string) => {
		if (mode !== "delete") return;
		setPlayers((players) => players.filter((p) => p.id !== id));
	};

	return (
		<div>
			<div style={{ marginBottom: 8 }}>
				<label>
					<input
						type="radio"
						value="add"
						checked={mode === "add"}
						onChange={() => setMode("add")}
					/>
					選手追加モード
				</label>
				<label style={{ marginLeft: 16 }}>
					<input
						type="radio"
						value="move"
						checked={mode === "move"}
						onChange={() => setMode("move")}
					/>
					選手移動モード
				</label>
				<label style={{ marginLeft: 16 }}>
					<input
						type="radio"
						value="delete"
						checked={mode === "delete"}
						onChange={() => setMode("delete")}
					/>
					選手削除モード
				</label>
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
							onClick={() => handlePlayerClick(player.id)}
						/>
					))}
				</Layer>
			</Stage>
		</div>
	);
}

export default App;
