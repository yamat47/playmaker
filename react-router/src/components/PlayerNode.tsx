import { Circle, Text, Group, Ring } from "react-konva";

type Props = {
	id: string;
	x: number;
	y: number;
	label: string;
	isSelected?: boolean;
};

export const PlayerNode = ({ x, y, label, isSelected = false }: Props) => {
	return (
		<Group x={x} y={y}>
			{/* 選択時のハイライトリング */}
			{isSelected && (
				<Ring
					innerRadius={24}
					outerRadius={28}
					fill="#22c55e"
					opacity={0.6}
				/>
			)}
			
			{/* 外側のボーダー */}
			<Circle
				radius={22}
				fill="#0f172a"
				stroke={isSelected ? "#22c55e" : "#334155"}
				strokeWidth={2}
			/>
			
			{/* 内側のメインサークル */}
			<Circle
				radius={18}
				fill="#1e293b"
				shadowColor="black"
				shadowBlur={8}
				shadowOpacity={0.4}
				shadowOffsetY={2}
			/>
			
			{/* プレイヤー番号 */}
			<Text
				text={label}
				fontSize={14}
				fontStyle="bold"
				fill="#f1f5f9"
				width={40}
				height={40}
				align="center"
				verticalAlign="middle"
				offsetX={20}
				offsetY={20}
			/>
		</Group>
	);
};
