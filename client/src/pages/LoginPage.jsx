import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { setAuth, isLoggedIn } from '../utils/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/rooms';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn() && !error) {
    // already logged in
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      setAuth(res.token, res.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-dvh flex flex-col bg-gradient-to-br from-brand-700 via-indigo-700 to-brand-900">
      <div className="px-4 py-4">
        <Link to="/" className="font-display font-bold text-white text-lg">
          Fun Game
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md space-y-5"
        >
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-slate-900">Host login</h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to create rooms and manage games
            </p>
          </div>

          <div>
            <label className="label">Email / username</label>
            <input
              type="email"
              className="input"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-xs text-slate-400">
            Participants: use <Link to="/join" className="text-brand-600 hover:underline">Join Game</Link> — no login needed
          </p>
        </form>
      </div>
    </div>
  );
}
