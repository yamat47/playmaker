import { Circle, Text, Group } from "react-konva";
import { useState } from "react";

type Props = {
  id: string;
  x: number;
  y: number;
  label: string;
  onDragMove: (id: string, x: number, y: number) => void;
};

export const PlayerNode = ({ id, x, y, label, onDragMove }: Props) => {
  const [isDragging, setDragging] = useState(false);

  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragStart={() => setDragging(true)}
      onDragEnd={(e) => {
        setDragging(false);
        onDragMove(id, e.target.x(), e.target.y());
      }}
    >
      <Circle
        radius={20}
        fill={isDragging ? "#2ecc71" : "#e74c3c"}
        shadowBlur={5}
      />
      <Text
        text={label}
        fontSize={18}
        fill="#fff"
        width={40}
        height={40}
        align="center"
        verticalAlign="middle"
        offsetX={20}
        offsetY={10}
      />
    </Group>
  );
};
