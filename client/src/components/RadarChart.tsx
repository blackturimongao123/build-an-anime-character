import type { Category, PlayerBoard } from "@build-character/shared";

const axes: { category: Category; label: string }[] = [
  { category: "abilities", label: "ABL" },
  { category: "iq", label: "IQ" },
  { category: "durability", label: "DUR" },
  { category: "strength", label: "STR" },
  { category: "speed", label: "SPD" },
];

function point(index: number, radius: number) {
  const angle = index * 2 * Math.PI / axes.length - Math.PI / 2;
  return [100 + radius * Math.cos(angle), 108 + radius * Math.sin(angle)];
}

export function RadarChart({ board }: { board: PlayerBoard }) {
  const maxRadius = 80;
  const values = axes.map(({ category }, index) =>
    point(index, maxRadius * (board.slots[category]?.stats[category] ?? 0) / 100),
  );

  return (
    <svg className="radar" viewBox="0 0 200 200" role="img" aria-label="Character stats radar">
      {[.25, .5, .75, 1].map((level) => (
        <polygon key={level} points={axes.map((_, index) => point(index, maxRadius * level).join(",")).join(" ")}
          fill="none" stroke="#fff5" strokeWidth=".6" />
      ))}
      {axes.map(({ label }, index) => {
        const [x, y] = point(index, maxRadius + 9);
        const [endX, endY] = point(index, maxRadius);
        return (
          <g key={label}>
            <path d={`M100 108 L${endX} ${endY}`} stroke="#fff7" strokeWidth=".7" />
            <text x={x} y={y} className="radar__label" textAnchor="middle" dominantBaseline="middle">{label}</text>
          </g>
        );
      })}
      <polygon points={values.map((value) => value.join(",")).join(" ")}
        fill="#ffd63799" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
      {values.map(([x, y], index) => <circle key={axes[index].category} cx={x} cy={y} r="2.8" fill="white" />)}
    </svg>
  );
}
