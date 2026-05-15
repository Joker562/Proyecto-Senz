
interface SeriesDef {
  key: string;
  color: string;
  label?: string;
}

interface LineChartSVGProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  xKey: string;
  series: SeriesDef[];
  width?: number;
  height?: number;
  yMin?: number;
  yMax?: number;
}

export function LineChartSVG({ data, xKey, series, width = 600, height = 180, yMin = 0, yMax = 100 }: LineChartSVGProps) {
  if (!data.length) return null;

  const padL = 32, padR = 16, padT = 16, padB = 28;
  const cw = width - padL - padR;
  const ch = height - padT - padB;
  const yRange = yMax - yMin || 1;

  const px = (i: number) => padL + (i / (data.length - 1)) * cw;
  const py = (v: number) => padT + ch - ((v - yMin) / yRange) * ch;

  const gridLines = 4;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padT + (i / gridLines) * ch;
        const val = Math.round(yMax - (i / gridLines) * yRange);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + cw} y2={y} stroke="#e8e8e8" strokeWidth={1} />
            <text x={padL - 4} y={y} textAnchor="end" dominantBaseline="middle"
              style={{ fontSize: 9, fill: '#aaa', fontFamily: 'IBM Plex Mono, monospace' }}>
              {val}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {data.map((row, i) => (
        <text key={i} x={px(i)} y={padT + ch + 14} textAnchor="middle"
          style={{ fontSize: 9, fill: '#aaa', fontFamily: 'IBM Plex Mono, monospace' }}>
          {row[xKey]}
        </text>
      ))}

      {/* Series */}
      {series.map(({ key, color }) => {
        const points: Array<[number, number]> = [];
        data.forEach((row, i) => {
          if (row[key] != null) points.push([px(i), py(row[key] as number)]);
        });
        if (points.length < 2) return null;
        const d = points.map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
        return (
          <g key={key}>
            <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map(([x, y], j) => (
              <circle key={j} cx={x} cy={y} r={3} fill={color} stroke="var(--sz-card)" strokeWidth={1.5} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
