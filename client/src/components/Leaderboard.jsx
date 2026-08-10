import { Trophy } from 'lucide-react';

export default function Leaderboard({ entries = [], presentMode = false }) {
  if (!entries.length) {
    return (
      <p className="text-center text-slate-400 py-6">No scores yet</p>
    );
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className={`${presentMode ? 'max-w-lg mx-auto' : ''}`}>
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h3 className={`font-display font-bold text-slate-800 ${presentMode ? 'text-2xl' : 'text-lg'}`}>
          Leaderboard
        </h3>
      </div>
      <div className="space-y-2">
        {entries.slice(0, presentMode ? 10 : 15).map((e) => (
          <div
            key={e.participantId}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              e.rank <= 3 ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50 border border-slate-100'
            }`}
          >
            <span className={`w-8 text-center font-bold ${presentMode ? 'text-xl' : 'text-base'}`}>
              {e.rank <= 3 ? medals[e.rank - 1] : e.rank}
            </span>
            <span className={`flex-1 font-medium text-slate-800 truncate ${presentMode ? 'text-lg' : ''}`}>
              {e.name}
            </span>
            <span className={`font-display font-bold text-brand-600 ${presentMode ? 'text-xl' : ''}`}>
              {e.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
