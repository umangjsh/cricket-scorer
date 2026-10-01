import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export default function Manhattan({ data }) {
  if (!data?.length) return <p className="muted">No overs bowled yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="over" tick={{ fontFamily: "var(--font-score)", fontSize: 12 }} />
        <YAxis tick={{ fontFamily: "var(--font-score)", fontSize: 12 }} />
        <Tooltip
          formatter={(value, name) => [value, name === "runs" ? "Runs" : name]}
          labelFormatter={(l) => `Over ${l}`}
        />
        <Bar dataKey="runs" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.wickets > 0 ? "var(--leather)" : "var(--pitch)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
