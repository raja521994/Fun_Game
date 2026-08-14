const authService = require('../services/authService');

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return req.headers['x-auth-token'] || null;
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    const user = authService.getUserBySessionToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Login required' });
    }
    req.user = user;
    req.authToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Login required' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, getBearerToken };
