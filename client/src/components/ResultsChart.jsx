import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from 'recharts';
import WordCloud from './WordCloud';

// Bright presentation palette (Mentimeter-style)
const COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#fbbf24', // yellow
  '#f472b6', // pink
  '#a78bfa', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
];

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={14}
      fontWeight={700}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function ResultsChart({ results, presentMode = false }) {
  if (!results) return null;

  const { type, options, average, words, totalAnswers, responses } = results;

  if (type === 'word_cloud') {
    return (
      <div>
        <p className="text-sm text-slate-500 mb-2 text-center">
          {totalAnswers} response{totalAnswers !== 1 ? 's' : ''}
        </p>
        <WordCloud words={words || []} maxFont={presentMode ? 56 : 40} />
      </div>
    );
  }

  if (type === 'open_text') {
    return (
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <p className="text-sm text-slate-500 mb-3">
          {totalAnswers} response{totalAnswers !== 1 ? 's' : ''}
        </p>
        {(responses || []).map((r, i) => (
          <div key={i} className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <p className="text-slate-800">{r.answer}</p>
            {!presentMode && (
              <p className="text-xs text-slate-400 mt-1">{r.participantName}</p>
            )}
          </div>
        ))}
        {!responses?.length && (
          <p className="text-center text-slate-400 py-8">No responses yet</p>
        )}
      </div>
    );
  }

  const data = (options || []).map((o) => ({
    name: o.text,
    count: o.count || 0,
    percentage: o.percentage || 0,
  }));

  // Pie for yes/no or few options in present mode
  const hasVotes = data.some((d) => d.count > 0);
  const usePie =
    presentMode &&
    hasVotes &&
    (type === 'yes_no' || (type === 'multiple_choice' && data.length > 0 && data.length <= 6));

  if (usePie) {
    const chartData = data;
    return (
      <div className="w-full">
        <div className="w-full h-full min-h-[200px] max-h-[min(360px,50vh)]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={presentMode ? 110 : 90}
                innerRadius={0}
                paddingAngle={1}
                stroke="#fff"
                strokeWidth={3}
                label={PieLabel}
                labelLine={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, _n, props) => [
                  `${v} (${props.payload.percentage}%)`,
                  props.payload.name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* External legend like Mentimeter callouts */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2 px-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-slate-700 font-medium">{d.name}</span>
              <span className="text-slate-400">{d.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vertical bars with count on top (Mentimeter bar style)
  if (presentMode) {
    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 24, right: 12, left: 4, bottom: 36 }}
          >
            <XAxis
              dataKey="name"
              interval={0}
              tick={{ fontSize: 12, fill: '#475569' }}
              angle={data.length > 5 ? -25 : 0}
              textAnchor={data.length > 5 ? 'end' : 'middle'}
              height={data.length > 5 ? 60 : 40}
            />
            <YAxis allowDecimals={false} hide />
            <Tooltip
              formatter={(v, _n, props) => [
                `${v} (${props.payload.percentage}%)`,
                'Votes',
              ]}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={72}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                style={{ fill: '#0f172a', fontWeight: 700, fontSize: 14 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Dashboard (non-present): horizontal bars
  return (
    <div>
      <p className="text-sm text-slate-500 mb-4 text-center">
        {totalAnswers} response{totalAnswers !== 1 ? 's' : ''}
        {type === 'rating' && average != null && ` · Avg ${average}`}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13 }} />
          <Tooltip
            formatter={(v, _n, props) => [
              `${v} (${props.payload.percentage}%)`,
              'Votes',
            ]}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
