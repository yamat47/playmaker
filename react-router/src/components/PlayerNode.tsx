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
					fill="var(--player-border-selected)"
					opacity={0.6}
				/>
			)}

			{/* 外側のボーダー */}
			<Circle
				radius={22}
				fill="var(--sidebar)"
				stroke={
					isSelected ? "var(--player-border-selected)" : "var(--player-border)"
				}
				strokeWidth={2}
			/>

			{/* 内側のメインサークル */}
			<Circle
				radius={18}
				fill="var(--player-bg)"
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
				fill="var(--player-text)"
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
