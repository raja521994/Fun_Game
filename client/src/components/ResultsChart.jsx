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

// Mentimeter-inspired palette
const COLORS = [
  '#3b82f6', // blue
  '#f472b6', // pink
  '#1e3a5f', // navy
  '#22c55e', // green
  '#ef4444', // red
  '#fbbf24', // yellow
  '#a78bfa', // purple
  '#f97316', // orange
];

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
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

/** Mentimeter-style horizontal rows with color tick + progress track */
function MentimeterBars({ data, presentMode }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className={`w-full space-y-4 ${presentMode ? 'py-2' : ''}`}>
      {data.map((d, i) => {
        const color = COLORS[i % COLORS.length];
        const widthPct = max > 0 ? (d.count / max) * 100 : 0;
        return (
          <div key={i} className="w-full">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-1 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span
                  className={`font-medium text-slate-700 truncate ${
                    presentMode ? 'text-base md:text-lg' : 'text-sm'
                  }`}
                >
                  {d.name}
                </span>
              </div>
              <span
                className={`tabular-nums font-semibold text-slate-500 shrink-0 ${
                  presentMode ? 'text-sm' : 'text-xs'
                }`}
              >
                {d.count > 0 ? `${d.count} · ${d.percentage}%` : '—'}
              </span>
            </div>
            <div className="h-3 md:h-3.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(widthPct, d.count > 0 ? 4 : 0)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
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

  // Rating: big average + bars
  if (type === 'rating') {
    return (
      <div className="w-full">
        {average != null && (
          <div className="text-center mb-4">
            <div className={`font-display font-bold text-brand-600 ${presentMode ? 'text-5xl' : 'text-3xl'}`}>
              {Number(average).toFixed(1)}
            </div>
            <p className="text-slate-500 text-sm">
              Average · {totalAnswers} response{totalAnswers !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        <MentimeterBars data={data} presentMode={presentMode} />
      </div>
    );
  }

  // Present mode with votes: optional pie for yes/no or few options
  const hasVotes = data.some((d) => d.count > 0);
  const usePie =
    presentMode &&
    hasVotes &&
    (type === 'yes_no' || (type === 'multiple_choice' && data.length > 0 && data.length <= 5));

  if (usePie && data.length <= 4) {
    return (
      <div className="w-full">
        <div className="w-full h-full min-h-[200px] max-h-[min(320px,45vh)]">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={3}
                label={PieLabel}
                labelLine={false}
              >
                {data.map((_, i) => (
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
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-1 px-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
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

  // Default Mentimeter horizontal theme (also when 0 votes)
  return (
    <div className="w-full">
      {!presentMode && (
        <p className="text-sm text-slate-500 mb-4 text-center">
          {totalAnswers} response{totalAnswers !== 1 ? 's' : ''}
        </p>
      )}
      <MentimeterBars data={data} presentMode={presentMode} />
    </div>
  );
}
