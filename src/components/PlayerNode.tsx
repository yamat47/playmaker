import { Circle, Text, Group } from "react-konva";
import { useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

type Props = {
	id: string;
	x: number;
	y: number;
	label: string;
	onDragMove: (id: string, x: number, y: number) => void;
	onClick?: (e: KonvaEventObject<MouseEvent>) => void;
	isSelected?: boolean;
};

export const PlayerNode = ({
	id,
	x,
	y,
	label,
	onDragMove,
	onClick,
	isSelected = false,
}: Props) => {
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
			onClick={onClick}
		>
			<Circle
				radius={22}
				fill={isDragging ? "#2ecc71" : "#e74c3c"}
				stroke={isSelected ? "#3498db" : "#222"}
				strokeWidth={isSelected ? 6 : 2}
				shadowBlur={isSelected ? 15 : 5}
			/>
			<Text
				text={label}
				fontSize={18}
				fill="#fff"
				width={40}
				height={40}
				align="center"
				verticalAlign="middle"
				offsetX={22}
				offsetY={12}
			/>
		</Group>
	);
};
