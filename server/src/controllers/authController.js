const authService = require('../services/authService');

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Login failed' });
  }
}

function logout(req, res) {
  try {
    authService.logout(req.authToken);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
}

function me(req, res) {
  res.json({ user: authService.publicUser(req.user) });
}

async function createUser(req, res) {
  try {
    const { email, password, name, role } = req.body || {};
    const user = await authService.createUser({ email, password, name, role }, req.user);
    res.status(201).json({ user });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to create user' });
  }
}

function listUsers(req, res) {
  try {
    const users = authService.listUsers(req.user);
    res.json({ users });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to list users' });
  }
}

function deleteUser(req, res) {
  try {
    authService.deleteUser(req.params.userId, req.user);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to delete user' });
  }
}

module.exports = { login, logout, me, createUser, listUsers, deleteUser };
