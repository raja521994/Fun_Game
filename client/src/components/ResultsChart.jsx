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
} from 'recharts';
import WordCloud from './WordCloud';

const COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#10b981', '#34d399', '#f59e0b', '#f97316'];

export default function ResultsChart({ results, presentMode = false }) {
  if (!results) return null;

  const { type, options, average, words, totalAnswers, responses } = results;

  if (type === 'word_cloud') {
    return (
      <div>
        <p className="text-sm text-slate-500 mb-2 text-center">{totalAnswers} response{totalAnswers !== 1 ? 's' : ''}</p>
        <WordCloud words={words || []} maxFont={presentMode ? 56 : 40} />
      </div>
    );
  }

  if (type === 'open_text') {
    return (
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <p className="text-sm text-slate-500 mb-3">{totalAnswers} response{totalAnswers !== 1 ? 's' : ''}</p>
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

  // multiple_choice, yes_no, rating — bar chart
  const data = (options || []).map((o) => ({
    name: o.text,
    count: o.count,
    percentage: o.percentage,
  }));

  if (type === 'rating' && presentMode) {
    return (
      <div className="text-center">
        <div className="text-6xl font-display font-bold text-brand-600 mb-2">
          {average != null ? average.toFixed(1) : '—'}
        </div>
        <p className="text-slate-500 mb-6">Average rating · {totalAnswers} responses</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 14 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v, name, props) => [`${v} (${props.payload.percentage}%)`, 'Votes']}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'yes_no' && data.length === 2) {
    const pieData = data.map((d) => ({ name: d.name, value: d.count }));
    return (
      <div>
        <p className="text-sm text-slate-500 mb-4 text-center">{totalAnswers} response{totalAnswers !== 1 ? 's' : ''}</p>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={presentMode ? 50 : 40}
                outerRadius={presentMode ? 80 : 70}
                paddingAngle={4}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3 min-w-[140px]">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: i === 0 ? '#10b981' : '#ef4444' }}
                />
                <span className="font-medium text-slate-700">{d.name}</span>
                <span className="text-slate-500 ml-auto">{d.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4 text-center">
        {totalAnswers} response{totalAnswers !== 1 ? 's' : ''}
        {type === 'rating' && average != null && ` · Avg ${average}`}
      </p>
      <ResponsiveContainer width="100%" height={presentMode ? 280 : 220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13 }} />
          <Tooltip
            formatter={(v, name, props) => [`${v} (${props.payload.percentage}%)`, 'Votes']}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={presentMode ? 28 : 22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
