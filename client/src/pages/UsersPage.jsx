import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Shield, User } from 'lucide-react';
import api from '../services/api';
import { getAuthUser, clearAuth, isLoggedIn } from '../utils/auth';

export default function UsersPage() {
  const navigate = useNavigate();
  const me = getAuthUser();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('host');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login', { state: { from: '/users' } });
      return;
    }
    if (me?.role !== 'admin') {
      navigate('/rooms');
      return;
    }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listUsers();
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message);
      if (err.status === 401) {
        clearAuth();
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createUser({ email: email.trim(), password, name: name.trim(), role });
      setEmail('');
      setPassword('');
      setName('');
      setRole('host');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    const target = users.find((u) => u.id === id);
    if (target?.isRoot) {
      setError('The root admin cannot be deleted');
      return;
    }
    if (!confirm('Delete this user? They will no longer be able to create rooms.')) return;
    try {
      await api.deleteUser(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-dvh">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/rooms" className="font-display font-bold text-brand-700">Fun Game</Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/rooms" className="text-slate-500 hover:text-brand-600">My rooms</Link>
            <span className="text-slate-400">{me?.email}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Manage hosts</h1>
        <p className="text-sm text-slate-500 mb-6">
          Add users who can log in and create rooms. Only admins can manage users.
        </p>

        <form onSubmit={handleCreate} className="card p-5 space-y-3 mb-8">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add user
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">Display name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="host">Host (create rooms)</option>
                <option value="admin">Admin (manage users + rooms)</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create user'}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-slate-400 text-center py-8">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="card p-4 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                  {u.role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{u.name || u.email}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                  {u.role}
                </span>
                {u.isRoot ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    Root
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(u.id)}
                    className="btn-ghost p-2 text-slate-400 hover:text-red-500"
                    title="Delete user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
