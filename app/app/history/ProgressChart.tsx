interface ChartPoint {
  date: string;
  weight: number;
  completed: boolean;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

/**
 * Per docs/todo.md §6 "Progress chart per lift". Plain inline SVG rather than
 * a charting dependency -- a single-series weight-over-time line for a
 * personal-scale tracker doesn't need one, and this renders server-side with
 * no client JS.
 */
export function ProgressChart({
  liftName,
  points,
}: {
  liftName: string;
  points: ChartPoint[];
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-neutral-500">
        Log a couple more {liftName} sessions to see a progress chart.
      </p>
    );
  }

  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const domainPad = Math.max((max - min) * 0.15, 2.5);
  const yMin = min - domainPad;
  const yMax = max + domainPad;

  const xAt = (i: number) =>
    PAD_LEFT +
    (points.length === 1 ? 0 : (i / (points.length - 1)) * PLOT_WIDTH);
  const yAt = (w: number) =>
    PAD_TOP + PLOT_HEIGHT - ((w - yMin) / (yMax - yMin)) * PLOT_HEIGHT;

  const linePath = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.weight).toFixed(1)}`,
    )
    .join(" ");

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const lastIndex = points.length - 1;
  const labelIndices = [...new Set([0, Math.floor(lastIndex / 2), lastIndex])];

  return (
    <div className="rounded border border-neutral-200 p-4">
      <h3 className="mb-2 text-sm font-semibold text-neutral-700">
        {liftName} progress
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${liftName} weight over time, from ${points[0].date} to ${points[lastIndex].date}`}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yAt(t)}
              y2={yAt(t)}
              className="stroke-neutral-200"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-neutral-400 text-[10px]"
            >
              {Math.round(t)}
            </text>
          </g>
        ))}

        <path
          d={linePath}
          fill="none"
          className="stroke-neutral-800"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(p.weight)}
            r={4}
            className={p.completed ? "fill-green-700" : "fill-amber-700"}
          >
            <title>{`${p.date}: ${p.weight} lb (${p.completed ? "completed" : "missed a set"})`}</title>
          </circle>
        ))}

        {labelIndices.map((i, idx) => (
          <text
            key={idx}
            x={xAt(i)}
            y={HEIGHT - 6}
            textAnchor={
              idx === 0
                ? "start"
                : idx === labelIndices.length - 1
                  ? "end"
                  : "middle"
            }
            className="fill-neutral-400 text-[10px]"
          >
            {points[i].date}
          </text>
        ))}
      </svg>

      <details className="mt-2 text-sm text-neutral-500">
        <summary>View as table</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr>
              <th className="pr-4 font-medium">Date</th>
              <th className="pr-4 font-medium">Weight</th>
              <th className="font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td className="pr-4">{p.date}</td>
                <td className="pr-4">{p.weight} lb</td>
                <td className={p.completed ? "text-green-700" : "text-amber-700"}>
                  {p.completed ? "Completed" : "Missed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
