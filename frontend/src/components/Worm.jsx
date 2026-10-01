import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

/** innings: [{ label, points: [{over, runs}] }] — one or two series overlaid on the same over axis. */
export default function Worm({ innings }) {
  if (!innings?.length) return <p className="muted">No data yet.</p>;

  const maxOver = Math.max(...innings.flatMap((i) => i.points.map((p) => p.over)), 1);
  const merged = Array.from({ length: maxOver + 1 }, (_, over) => {
    const row = { over };
    innings.forEach((series) => {
      const point = [...series.points].reverse().find((p) => p.over <= over);
      row[series.label] = point ? point.runs : null;
    });
    return row;
  });

  const colors = ["var(--pitch)", "var(--leather)"];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={merged}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="over" tick={{ fontFamily: "var(--font-score)", fontSize: 12 }} />
        <YAxis tick={{ fontFamily: "var(--font-score)", fontSize: 12 }} />
        <Tooltip labelFormatter={(l) => `Over ${l}`} />
        <Legend />
        {innings.map((series, i) => (
          <Line
            key={series.label}
            type="monotone"
            dataKey={series.label}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
