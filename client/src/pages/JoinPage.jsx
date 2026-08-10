import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';

export default function JoinPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeParam || '');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (codeParam) setCode(codeParam.toUpperCase());
  }, [codeParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (cleanCode.length !== 6) {
      setError('Room code must be 6 characters.');
      return;
    }
    if (!cleanName) {
      setError('Please enter a display name.');
      return;
    }

    setLoading(true);
    try {
      await api.getRoomByCode(cleanCode);
      // Store name for the play page
      sessionStorage.setItem(`playerName:${cleanCode}`, cleanName);
      navigate(`/play/${cleanCode}`);
    } catch (err) {
      if (err.status === 404) setError('Room not found. Check the code and try again.');
      else if (err.status === 410) setError('This game has already ended.');
      else setError(err.message || 'Could not join room.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-brand-50 to-slate-50">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="card p-8 animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl font-bold text-slate-900">Join Game</h1>
            <p className="text-slate-500 mt-1">Enter the room code from your host</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="code">
                Room code
              </label>
              <input
                id="code"
                className="input text-center text-2xl font-bold tracking-[0.3em] uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
                autoFocus={!codeParam}
              />
            </div>

            <div>
              <label className="label" htmlFor="name">
                Your display name
              </label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder="e.g. Alex"
                maxLength={40}
                autoFocus={!!codeParam}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
              {loading ? 'Joining…' : 'Join Game'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
