import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Users, Smartphone, Shield } from 'lucide-react';
import { isLoggedIn } from '../utils/auth';

export default function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!isLoggedIn()) {
      navigate('/login', { state: { from: '/rooms' } });
      return;
    }
    navigate('/rooms');
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-accent-400/30 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4 text-accent-400" />
            Real-time audience engagement
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            Fun Game
          </h1>
          <p className="text-lg sm:text-xl text-indigo-100 max-w-2xl mx-auto mb-10">
            Create interactive games, polls and quizzes for your team.
            No registration required — start in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleCreate}
              disabled={false}
              className="btn-accent text-lg px-8 py-4 min-w-[200px] shadow-lg shadow-emerald-900/20"
            >
              'Create Game'
            </button>
            <button
              onClick={() => navigate('/join')}
              className="btn bg-white/15 hover:bg-white/25 text-white border border-white/30 text-lg px-8 py-4 min-w-[200px]"
            >
              Join Game
            </button>
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => navigate('/rooms')}
              className="text-sm text-indigo-100 hover:text-white underline-offset-2 hover:underline"
            >
              My rooms — manage multiple sessions
            </button>
          </div>
          {error && (
            <p className="mt-4 text-red-200 text-sm bg-red-900/30 inline-block px-4 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>
      </header>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-center text-slate-800 mb-12">
          Everything you need for live engagement
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Zap,
              title: 'Real-time interaction',
              desc: 'Live polls, quizzes and word clouds that update instantly.',
            },
            {
              icon: Smartphone,
              title: 'Mobile friendly',
              desc: 'Participants join from any phone or browser with a short code.',
            },
            {
              icon: Users,
              title: 'No registration',
              desc: 'Hosts get a private link. Participants only need a room code.',
            },
            {
              icon: Shield,
              title: 'Simple & secure',
              desc: 'Private host controls. Cryptographically random room codes.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6 text-center hover:shadow-soft transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Question types preview */}
      <section className="bg-slate-100/80 py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-center text-slate-800 mb-8">
            Supported question types
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['Multiple Choice', 'Word Cloud', 'Rating', 'Yes / No', 'Open Text', 'Quiz Mode'].map(
              (t) => (
                <span
                  key={t}
                  className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium shadow-sm"
                >
                  {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <footer className="mt-auto py-8 text-center text-sm text-slate-400">
        <p>Fun Game — open source interactive audience platform</p>
      </footer>
    </div>
  );
}
