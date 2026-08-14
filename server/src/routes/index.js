const express = require('express');
const roomController = require('../controllers/roomController');
const questionController = require('../controllers/questionController');
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRoomLimiter, joinLimiter, apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(apiLimiter);

// Auth
router.post('/auth/login', authController.login);
router.post('/auth/logout', requireAuth, authController.logout);
router.get('/auth/me', requireAuth, authController.me);

// User management (admin only)
router.get('/users', requireAdmin, authController.listUsers);
router.post('/users', requireAdmin, authController.createUser);
router.delete('/users/:userId', requireAdmin, authController.deleteUser);

// Rooms — create requires login; join stays public
router.post('/rooms', requireAuth, createRoomLimiter, roomController.createRoom);
router.get('/rooms/mine', requireAuth, roomController.listMyRooms);
router.get('/rooms/code/:code', joinLimiter, roomController.getRoomByCode);
router.get('/rooms/host/:token', roomController.getHostRoom);
router.post('/rooms/end', roomController.endRoom);
router.get('/rooms/export', roomController.exportResults);

// Questions (host token)
router.post('/questions', questionController.createQuestion);
router.get('/questions', questionController.listQuestions);
router.post('/questions/:questionId/start', questionController.startQuestion);
router.post('/questions/:questionId/stop', questionController.stopQuestion);
router.get('/questions/:questionId/results', questionController.getResults);
router.delete('/questions/:questionId', questionController.deleteQuestion);
router.get('/leaderboard', questionController.getLeaderboard);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
