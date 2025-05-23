import { Circle, Text } from "react-konva";

type Props = {
	id: string;
	x: number;
	y: number;
	label: string;
	isSelected?: boolean;
};

export const PlayerNode = ({ x, y, label, isSelected = false }: Props) => {
	return (
		<>
			<Circle
				x={x}
				y={y}
				radius={22}
				fill={"#e74c3c"}
				stroke={isSelected ? "#3498db" : "#222"}
				strokeWidth={isSelected ? 6 : 2}
			/>
			<Text
				x={x - 22}
				y={y - 12}
				text={label}
				fontSize={18}
				fill="#fff"
				width={40}
				height={40}
				align="center"
				verticalAlign="middle"
				offsetX={0}
				offsetY={0}
			/>
		</>
	);
};
