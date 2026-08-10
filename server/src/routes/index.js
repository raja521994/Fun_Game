const express = require('express');
const roomController = require('../controllers/roomController');
const questionController = require('../controllers/questionController');
const { createRoomLimiter, joinLimiter, apiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.use(apiLimiter);

// Rooms
router.post('/rooms', createRoomLimiter, roomController.createRoom);
router.get('/rooms/code/:code', joinLimiter, roomController.getRoomByCode);
router.get('/rooms/host/:token', roomController.getHostRoom);
router.post('/rooms/end', roomController.endRoom);
router.get('/rooms/export', roomController.exportResults);

// Questions (host)
router.post('/questions', questionController.createQuestion);
router.get('/questions', questionController.listQuestions);
router.post('/questions/:questionId/start', questionController.startQuestion);
router.post('/questions/:questionId/stop', questionController.stopQuestion);
router.get('/questions/:questionId/results', questionController.getResults);
router.delete('/questions/:questionId', questionController.deleteQuestion);
router.get('/leaderboard', questionController.getLeaderboard);

// Health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
