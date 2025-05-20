import { Stage, Layer } from "react-konva";
import { useState } from "react";
import { PlayerNode } from "./components/PlayerNode";

type Player = {
  id: string;
  x: number;
  y: number;
  label: string;
};

function App() {
  const [players, setPlayers] = useState<Player[]>([
    { id: "X", x: 100, y: 100, label: "X" },
    { id: "Z", x: 300, y: 100, label: "Z" }
  ]);

  const handleDragMove = (id: string, x: number, y: number) => {
    setPlayers(players =>
      players.map(p =>
        p.id === id ? { ...p, x, y } : p
      )
    );
  };

  return (
    <Stage width={800} height={600} style={{ background: "#f3f3f3" }}>
      <Layer>
        {players.map(player => (
          <PlayerNode
            key={player.id}
            {...player}
            onDragMove={handleDragMove}
          />
        ))}
      </Layer>
    </Stage>
  );
}

export default App;
