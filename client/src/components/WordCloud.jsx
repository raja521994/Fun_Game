/**
 * Simple word cloud visualization without external paid APIs.
 * Sizes words by frequency and lays them out in a flowing flex container.
 */
export default function WordCloud({ words = [], maxFont = 48, minFont = 14 }) {
  if (!words.length) {
    return (
      <p className="text-center text-slate-400 py-12">No responses yet</p>
    );
  }

  const maxVal = Math.max(...words.map((w) => w.value), 1);
  const colors = [
    'text-brand-600',
    'text-indigo-500',
    'text-violet-500',
    'text-accent-600',
    'text-sky-600',
    'text-fuchsia-500',
    'text-rose-500',
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-6 px-2 min-h-[180px]">
      {words.map((w, i) => {
        const ratio = w.value / maxVal;
        const size = Math.round(minFont + ratio * (maxFont - minFont));
        const color = colors[i % colors.length];
        return (
          <span
            key={`${w.text}-${i}`}
            className={`word-cloud-item font-semibold ${color}`}
            style={{ fontSize: `${size}px`, lineHeight: 1.2 }}
            title={`${w.text}: ${w.value}`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
}
