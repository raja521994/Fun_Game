const { findOne, findMany, insert, update, remove } = require('../database/db');
const { hashPassword, verifyPassword, createToken } = require('../utils/password');
const { generateId } = require('../utils/codes');

const ROOT_EMAIL = 'Rajagopalan.Govindarajan@hlag.com';
const ROOT_PASSWORD = 'GOVINRJ';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function ensureRootAdmin() {
  const existing = findOne('users', (u) => normalizeEmail(u.email) === normalizeEmail(ROOT_EMAIL));
  if (existing) return existing;

  const passwordHash = await hashPassword(ROOT_PASSWORD);
  const user = {
    id: generateId(),
    email: ROOT_EMAIL,
    password_hash: passwordHash,
    role: 'admin',
    name: 'Rajagopalan Govindarajan',
    created_at: new Date().toISOString(),
    created_by: null,
  };
  insert('users', user);
  console.log('Seeded root admin user:', ROOT_EMAIL);
  return user;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    name: u.name || u.email,
    createdAt: u.created_at,
  };
}

async function login(email, password) {
  await ensureRootAdmin();
  const user = findOne('users', (u) => normalizeEmail(u.email) === normalizeEmail(email));
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  // drop old sessions for this user (single session)
  remove('sessions', (s) => s.user_id === user.id);

  const token = createToken();
  insert('sessions', {
    id: generateId(),
    token,
    user_id: user.id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  });

  return { token, user: publicUser(user) };
}

function logout(token) {
  if (!token) return;
  remove('sessions', (s) => s.token === token);
}

function getUserBySessionToken(token) {
  if (!token) return null;
  const session = findOne('sessions', (s) => s.token === token);
  if (!session) return null;
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    remove('sessions', (s) => s.token === token);
    return null;
  }
  const user = findOne('users', (u) => u.id === session.user_id);
  return user || null;
}

async function createUser({ email, password, name, role }, actor) {
  if (!actor || actor.role !== 'admin') {
    const err = new Error('Only admins can create users');
    err.status = 403;
    throw err;
  }
  const em = normalizeEmail(email);
  if (!em || !em.includes('@')) {
    const err = new Error('Valid email is required');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < 4) {
    const err = new Error('Password must be at least 4 characters');
    err.status = 400;
    throw err;
  }
  if (findOne('users', (u) => normalizeEmail(u.email) === em)) {
    const err = new Error('A user with this email already exists');
    err.status = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);
  const user = {
    id: generateId(),
    email: em,
    password_hash: passwordHash,
    role: role === 'admin' ? 'admin' : 'host',
    name: (name || em.split('@')[0]).toString().slice(0, 100),
    created_at: new Date().toISOString(),
    created_by: actor.id,
  };
  insert('users', user);
  return publicUser(user);
}

function listUsers(actor) {
  if (!actor || actor.role !== 'admin') {
    const err = new Error('Only admins can list users');
    err.status = 403;
    throw err;
  }
  return findMany('users').map(publicUser);
}

function deleteUser(userId, actor) {
  if (!actor || actor.role !== 'admin') {
    const err = new Error('Only admins can delete users');
    err.status = 403;
    throw err;
  }
  const target = findOne('users', (u) => u.id === userId);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (normalizeEmail(target.email) === normalizeEmail(ROOT_EMAIL)) {
    const err = new Error('Cannot delete the root admin');
    err.status = 400;
    throw err;
  }
  if (target.id === actor.id) {
    const err = new Error('Cannot delete your own account');
    err.status = 400;
    throw err;
  }
  remove('users', (u) => u.id === userId);
  remove('sessions', (s) => s.user_id === userId);
  return true;
}

module.exports = {
  ensureRootAdmin,
  login,
  logout,
  getUserBySessionToken,
  createUser,
  listUsers,
  deleteUser,
  publicUser,
  ROOT_EMAIL,
};
