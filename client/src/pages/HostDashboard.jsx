import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Monitor, Users, Trash2, ArrowRight, Copy, Check, QrCode } from 'lucide-react';
import api from '../services/api';
import { loadHostRooms, upsertHostRoom, removeHostRoom } from '../utils/hostRooms';
import { isLoggedIn, getAuthUser, clearAuth } from '../utils/auth';

export default function HostDashboard() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const refresh = () => setRooms(loadHostRooms());

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { state: { from: '/rooms' } });
      return;
    }
    refresh();
  }, [navigate]);

  const user = getAuthUser();

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* */ }
    clearAuth();
    navigate('/login');
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    setCreating(true);
    setError('');
    try {
      const room = await api.createRoom(title.trim() || `Room ${loadHostRooms().length + 1}`);
      upsertHostRoom({
        hostToken: room.hostToken,
        roomCode: room.roomCode,
        roomId: room.roomId,
        title: room.title || title || 'Fun Game Session',
        status: room.status || 'waiting',
        createdAt: new Date().toISOString(),
      });
      setTitle('');
      refresh();
      navigate(`/host/${room.hostToken}`);
    } catch (err) {
      setError(err.message || 'Could not create room');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = (hostToken, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Remove this room from your list? (The room still exists on the server until it ends.)')) return;
    removeHostRoom(hostToken);
    refresh();
  };

  const copyCode = (code, e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="flex-1 bg-slate-50 min-h-dvh">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-display font-bold text-brand-700 text-lg">Fun Game</Link>
          <div className="flex items-center gap-3 text-sm">
            {user?.role === 'admin' && (
              <Link to="/users" className="text-slate-500 hover:text-brand-600">Manage users</Link>
            )}
            <Link to="/join" className="text-slate-500 hover:text-brand-600">Join a room</Link>
            {user && (
              <button type="button" onClick={handleLogout} className="text-slate-400 hover:text-red-500">
                Log out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Your rooms</h1>
            <p className="text-slate-500 text-sm mt-1">
              Create multiple rooms. Each has its own code, QR, questions, and results.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="card p-4 sm:p-5 mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="label">New room name</label>
            <input
              className="input"
              placeholder="e.g. Marketing quiz, Team icebreaker"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>
          <button type="submit" className="btn-primary shrink-0" disabled={creating}>
            <Plus className="w-4 h-4" />
            {creating ? 'Creating…' : 'Create room'}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {rooms.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <Monitor className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="mb-1 font-medium text-slate-600">No rooms yet</p>
            <p className="text-sm">Create a room to get a code and host dashboard.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rooms.map((r) => {
              const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=8&data=${encodeURIComponent(
                `${origin}/join/${r.roomCode}`
              )}`;
              return (
                <li key={r.hostToken}>
                  <Link
                    to={`/host/${r.hostToken}`}
                    className="card p-4 flex flex-col sm:flex-row gap-4 items-center hover:border-brand-200 hover:shadow-md transition border border-transparent"
                  >
                    <img
                      src={qrSrc}
                      alt={`QR ${r.roomCode}`}
                      className="w-20 h-20 rounded-xl bg-white border border-slate-100 shrink-0"
                      width={80}
                      height={80}
                    />
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <h2 className="font-display font-bold text-slate-900 truncate">
                        {r.title || 'Untitled room'}
                      </h2>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                        <button
                          type="button"
                          onClick={(e) => copyCode(r.roomCode, e)}
                          className="inline-flex items-center gap-1.5 font-mono font-bold tracking-widest text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg text-sm"
                        >
                          {r.roomCode}
                          {copied === r.roomCode ? (
                            <Check className="w-3.5 h-3.5 text-accent-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            r.status === 'ended'
                              ? 'bg-red-100 text-red-600'
                              : r.status === 'active'
                              ? 'bg-accent-500/15 text-accent-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {r.status || 'waiting'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="btn-secondary text-sm py-2 pointer-events-none">
                        <Monitor className="w-4 h-4" /> Open
                        <ArrowRight className="w-4 h-4" />
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleRemove(r.hostToken, e)}
                        className="btn-ghost text-slate-400 hover:text-red-500 p-2"
                        title="Remove from list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-slate-400 mt-8 text-center max-w-md mx-auto">
          Rooms are saved in this browser. Use the same device to manage them. Each room has a unique code and QR for participants.
        </p>
      </main>
    </div>
  );
}
