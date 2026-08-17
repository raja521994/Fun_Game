const roomService = require('../services/roomService');
const questionService = require('../services/questionService');

function requireHost(req) {
  const token = req.headers['x-host-token'] || req.body.hostToken;
  if (!token) {
    const err = new Error('Host token required');
    err.status = 401;
    throw err;
  }
  const room = roomService.getRoomByHostToken(token);
  if (!room) {
    const err = new Error('Invalid host token');
    err.status = 403;
    throw err;
  }
  return room;
}

function createQuestion(req, res) {
  try {
    const room = requireHost(req);
    const { type, questionText, options, isQuiz, correctOptionIndex, timerSeconds, revealAtEnd } = req.body;

    const question = questionService.createQuestion(room.id, {
      type,
      questionText,
      options,
      isQuiz: !!isQuiz,
      correctOptionIndex: correctOptionIndex != null ? Number(correctOptionIndex) : null,
      timerSeconds: timerSeconds ? Number(timerSeconds) : 0,
      revealAtEnd: !!revealAtEnd,
    });

    res.status(201).json(question);
  } catch (err) {
    console.error('createQuestion error:', err);
    res.status(err.status || 400).json({ error: err.message || 'Failed to create question' });
  }
}

function listQuestions(req, res) {
  try {
    const room = requireHost(req);
    const questions = questionService.getQuestionsByRoom(room.id);
    res.json(questions);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to list questions' });
  }
}

function startQuestion(req, res) {
  try {
    const room = requireHost(req);
    const { questionId } = req.params;
    const q = questionService.getQuestionById(questionId);
    if (!q || q.room_id !== room.id) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const started = questionService.startQuestion(questionId);
    roomService.updateRoomStatus(room.id, 'active');
    res.json(started);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Failed to start question' });
  }
}

function stopQuestion(req, res) {
  try {
    const room = requireHost(req);
    const { questionId } = req.params;
    const q = questionService.getQuestionById(questionId);
    if (!q || q.room_id !== room.id) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const stopped = questionService.stopQuestion(questionId);
    res.json(stopped);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Failed to stop question' });
  }
}

function getResults(req, res) {
  try {
    const { questionId } = req.params;
    const q = questionService.getQuestionById(questionId);
    if (!q) return res.status(404).json({ error: 'Question not found' });

    // Host can always see; participants only after results status or stopped
    const token = req.headers['x-host-token'];
    const isHost = token && roomService.getRoomByHostToken(token)?.id === q.room_id;

    if (!isHost && q.status === 'active') {
      return res.status(403).json({ error: 'Results not available yet' });
    }

    const results = questionService.getResults(questionId);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to get results' });
  }
}

function getLeaderboard(req, res) {
  try {
    const room = requireHost(req);
    const board = questionService.getLeaderboard(room.id);
    res.json(board);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to get leaderboard' });
  }
}

function deleteQuestion(req, res) {
  try {
    const room = requireHost(req);
    const { questionId } = req.params;
    const q = questionService.getQuestionById(questionId);
    if (!q || q.room_id !== room.id) {
      return res.status(404).json({ error: 'Question not found' });
    }
    questionService.deleteQuestion(questionId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Failed to delete question' });
  }
}

module.exports = {
  createQuestion,
  listQuestions,
  startQuestion,
  stopQuestion,
  getResults,
  getLeaderboard,
  deleteQuestion,
};
