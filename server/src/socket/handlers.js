const roomService = require('../services/roomService');
const participantService = require('../services/participantService');
const questionService = require('../services/questionService');
const { findOne } = require('../database/db');

/**
 * Socket.IO event handlers.
 * Room rooms are joined as: room:{roomId}
 * Host also joins host:{roomId}
 */
function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Host joins their control channel
    socket.on('host_join', ({ hostToken }, callback) => {
      try {
        const room = roomService.getRoomByHostToken(hostToken);
        if (!room) {
          return callback?.({ error: 'Invalid host token' });
        }
        if (room.status === 'ended') {
          return callback?.({ error: 'Game has ended' });
        }

        socket.join(`room:${room.id}`);
        socket.join(`host:${room.id}`);
        socket.data.role = 'host';
        socket.data.roomId = room.id;
        socket.data.hostToken = hostToken;

        const participants = participantService.getParticipants(room.id);
        const questions = questionService.getQuestionsByRoom(room.id);
        const activeQuestion = questionService.getActiveQuestion(room.id);
        const leaderboard = questionService.getLeaderboard(room.id);

        callback?.({
          success: true,
          room: {
            roomId: room.id,
            roomCode: room.room_code,
            status: room.status,
            title: room.title,
          },
          participants,
          questions,
          activeQuestion,
          leaderboard,
        });
      } catch (err) {
        console.error('host_join error:', err);
        callback?.({ error: 'Failed to join as host' });
      }
    });

    // Participant joins room
    socket.on('join_room', ({ roomCode, name }, callback) => {
      try {
        if (!roomCode || !name) {
          return callback?.({ error: 'Room code and name are required' });
        }
        const cleanName = String(name).trim().slice(0, 40);
        if (!cleanName) {
          return callback?.({ error: 'Display name is required' });
        }

        const room = roomService.getRoomByCode(String(roomCode).toUpperCase());
        if (!room) {
          return callback?.({ error: 'Room not found. Check the code and try again.' });
        }
        if (room.status === 'ended') {
          return callback?.({ error: 'This game has already ended.' });
        }

        const participant = participantService.joinRoom(room.id, cleanName, socket.id);
        socket.join(`room:${room.id}`);
        socket.data.role = 'participant';
        socket.data.roomId = room.id;
        socket.data.participantId = participant.id;
        socket.data.name = participant.name;

        const activeQuestion = questionService.getActiveQuestion(room.id);
        // Don't send correct answer info to participants
        let safeQuestion = null;
        if (activeQuestion && activeQuestion.status === 'active') {
          safeQuestion = sanitizeQuestionForParticipant(activeQuestion);
        }

        // Notify host and others
        io.to(`host:${room.id}`).emit('participant_joined', {
          participant: {
            id: participant.id,
            name: participant.name,
            is_online: 1,
          },
          participantCount: roomService.getParticipantCount(room.id),
          onlineCount: roomService.getOnlineCount(room.id),
        });

        callback?.({
          success: true,
          participantId: participant.id,
          name: participant.name,
          roomCode: room.room_code,
          roomId: room.id,
          reconnected: participant.reconnected,
          activeQuestion: safeQuestion,
        });
      } catch (err) {
        console.error('join_room error:', err);
        if (err.message && err.message.includes('UNIQUE')) {
          return callback?.({ error: 'That name is already taken in this room.' });
        }
        callback?.({ error: 'Failed to join room' });
      }
    });

    // Host starts a question
    socket.on('start_question', ({ questionId }, callback) => {
      try {
        if (socket.data.role !== 'host') {
          return callback?.({ error: 'Unauthorized' });
        }
        const roomId = socket.data.roomId;
        const q = questionService.getQuestionById(questionId);
        if (!q || q.room_id !== roomId) {
          return callback?.({ error: 'Question not found' });
        }

        const started = questionService.startQuestion(questionId);
        roomService.updateRoomStatus(roomId, 'active');

        const safe = sanitizeQuestionForParticipant(started);

        io.to(`room:${roomId}`).emit('question_started', {
          question: safe,
          startedAt: Date.now(),
        });

        // Notify host with full data
        io.to(`host:${roomId}`).emit('question_started_host', {
          question: started,
          startedAt: Date.now(),
        });

        callback?.({ success: true, question: started });
      } catch (err) {
        console.error('start_question error:', err);
        callback?.({ error: err.message || 'Failed to start question' });
      }
    });

    // Host stops accepting answers
    socket.on('stop_question', ({ questionId }, callback) => {
      try {
        if (socket.data.role !== 'host') {
          return callback?.({ error: 'Unauthorized' });
        }
        const roomId = socket.data.roomId;
        const q = questionService.getQuestionById(questionId);
        if (!q || q.room_id !== roomId) {
          return callback?.({ error: 'Question not found' });
        }

        const stopped = questionService.stopQuestion(questionId);
        const results = questionService.getResults(questionId);

        io.to(`room:${roomId}`).emit('question_stopped', {
          questionId,
          results: sanitizeResultsForParticipants(results, stopped),
        });

        io.to(`host:${roomId}`).emit('results_updated', {
          questionId,
          results,
        });

        callback?.({ success: true, results });
      } catch (err) {
        console.error('stop_question error:', err);
        callback?.({ error: err.message || 'Failed to stop question' });
      }
    });

    // Host shows results (explicit)
    socket.on('show_results', ({ questionId }, callback) => {
      try {
        if (socket.data.role !== 'host') {
          return callback?.({ error: 'Unauthorized' });
        }
        const roomId = socket.data.roomId;
        const q = questionService.getQuestionById(questionId);
        if (!q || q.room_id !== roomId) {
          return callback?.({ error: 'Question not found' });
        }

        questionService.setResultsStatus(questionId);
        const results = questionService.getResults(questionId);
        const leaderboard = questionService.getLeaderboard(roomId);

        io.to(`room:${roomId}`).emit('results_updated', {
          questionId,
          results: sanitizeResultsForParticipants(results, q),
          leaderboard: q.is_quiz ? leaderboard : undefined,
        });

        io.to(`host:${roomId}`).emit('results_updated', {
          questionId,
          results,
          leaderboard,
        });

        callback?.({ success: true, results, leaderboard });
      } catch (err) {
        console.error('show_results error:', err);
        callback?.({ error: err.message || 'Failed to show results' });
      }
    });

    // Participant submits answer
    socket.on('submit_answer', ({ questionId, optionId, answerText, responseTimeMs }, callback) => {
      try {
        if (socket.data.role !== 'participant' || !socket.data.participantId) {
          return callback?.({ error: 'Unauthorized' });
        }

        const result = questionService.submitAnswer({
          questionId,
          participantId: socket.data.participantId,
          optionId,
          answerText,
          responseTimeMs,
        });

        const roomId = socket.data.roomId;
        const results = questionService.getResults(questionId);
        const answerStatus = participantService.getParticipantAnswerStatus(roomId, questionId);

        io.to(`host:${roomId}`).emit('answer_received', {
          questionId,
          participantId: socket.data.participantId,
          name: socket.data.name,
          results,
          answerStatus,
        });

        // Live partial results to host only (participants wait)
        io.to(`host:${roomId}`).emit('results_updated', {
          questionId,
          results,
          live: true,
        });

        callback?.({
          success: true,
          isCorrect: result.isCorrect,
          score: result.score,
        });
      } catch (err) {
        console.error('submit_answer error:', err);
        callback?.({ error: err.message || 'Failed to submit answer' });
      }
    });

    // Host creates question via socket (optional, also available via REST)
    socket.on('question_created', async () => {
      // Clients listen; creation is via REST then broadcast
    });

    socket.on('broadcast_question_created', ({ question }, callback) => {
      try {
        if (socket.data.role !== 'host') return callback?.({ error: 'Unauthorized' });
        const roomId = socket.data.roomId;
        io.to(`host:${roomId}`).emit('question_created', { question });
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: 'Failed' });
      }
    });

    // Host presentation phase sync (lobby / next / ready_results / final_scores)
    socket.on('present_phase', ({ phase, leaderboard: lb, review }, callback) => {
      try {
        if (socket.data.role !== 'host') {
          return callback?.({ error: 'Unauthorized' });
        }
        const roomId = socket.data.roomId;
        if (!roomId) return callback?.({ error: 'No room' });

        const payload = { phase: phase || 'waiting' };
        if (phase === 'final_scores' || phase === 'ready_results') {
          const leaderboard = lb || questionService.getLeaderboard(roomId);
          payload.leaderboard = leaderboard;
        }
        if (phase === 'answer_review' && review) {
          payload.review = review;
        }
        if (phase === 'thank_you') {
          const room = roomService.getRoomById(roomId);
          payload.thankYouMessage = room?.thank_you_message || 'Thank you for playing!';
        }
        if (phase === 'feedback') {
          const qs = questionService.getQuestionsByRoom(roomId).filter((q) => q.type === 'feedback');
          payload.feedbackQuestions = qs.map((q) => ({
            id: q.id,
            questionText: q.question_text,
            options: (q.options || []).map((o) => ({ id: o.id, text: o.option_text })),
          }));
        }
        io.to(`room:${roomId}`).emit('present_phase', payload);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: err.message || 'Failed' });
      }
    });

    // End game
    socket.on('end_game', (callback) => {
      try {
        if (socket.data.role !== 'host') {
          return callback?.({ error: 'Unauthorized' });
        }
        const roomId = socket.data.roomId;
        roomService.updateRoomStatus(roomId, 'ended');

        io.to(`room:${roomId}`).emit('game_ended', {
          message: 'The host has ended the game. Thanks for playing!',
        });

        callback?.({ success: true });
      } catch (err) {
        callback?.({ error: 'Failed to end game' });
      }
    });

    // Timer expired (client-side host or server can trigger)
    socket.on('timer_expired', ({ questionId }, callback) => {
      try {
        if (socket.data.role !== 'host') {
          return callback?.({ error: 'Unauthorized' });
        }
        const roomId = socket.data.roomId;
        const q = questionService.getQuestionById(questionId);
        if (!q || q.room_id !== roomId || q.status !== 'active') {
          return callback?.({ error: 'Question not active' });
        }

        const stopped = questionService.stopQuestion(questionId);
        const results = questionService.getResults(questionId);
        const leaderboard = questionService.getLeaderboard(roomId);

        io.to(`room:${roomId}`).emit('question_stopped', {
          questionId,
          reason: 'timer',
          results: sanitizeResultsForParticipants(results, stopped),
          leaderboard: stopped.is_quiz ? leaderboard : undefined,
        });

        io.to(`host:${roomId}`).emit('results_updated', {
          questionId,
          results,
          leaderboard,
          reason: 'timer',
        });

        callback?.({ success: true, results });
      } catch (err) {
        callback?.({ error: err.message || 'Failed' });
      }
    });

    // Request current state (reconnect support)
    socket.on('sync_state', (callback) => {
      try {
        const roomId = socket.data.roomId;
        if (!roomId) return callback?.({ error: 'Not in a room' });

        const room = roomService.getRoomById(roomId);
        if (!room || room.status === 'ended') {
          return callback?.({ error: 'Room ended', ended: true });
        }

        const activeQuestion = questionService.getActiveQuestion(roomId);
        if (socket.data.role === 'host') {
          const participants = participantService.getParticipants(roomId);
          const questions = questionService.getQuestionsByRoom(roomId);
          const leaderboard = questionService.getLeaderboard(roomId);
          return callback?.({
            success: true,
            role: 'host',
            room: { roomId: room.id, roomCode: room.room_code, status: room.status },
            participants,
            questions,
            activeQuestion,
            leaderboard,
          });
        }

        // Participant
        let safeQuestion = null;
        if (activeQuestion && activeQuestion.status === 'active') {
          safeQuestion = sanitizeQuestionForParticipant(activeQuestion);
          // Check if already answered
          const existing = findOne(
            'answers',
            (a) => a.question_id === activeQuestion.id && a.participant_id === socket.data.participantId
          );
          if (existing) {
            safeQuestion = { ...safeQuestion, alreadyAnswered: true };
          }
        }

        callback?.({
          success: true,
          role: 'participant',
          activeQuestion: safeQuestion,
          roomStatus: room.status,
        });
      } catch (err) {
        callback?.({ error: 'Sync failed' });
      }
    });

    socket.on('disconnect', () => {
      try {
        if (socket.data.role === 'participant' && socket.data.roomId) {
          const p = participantService.setOfflineBySocket(socket.id);
          if (p) {
            io.to(`host:${socket.data.roomId}`).emit('participant_left', {
              participantId: p.id,
              name: p.name,
              participantCount: roomService.getParticipantCount(socket.data.roomId),
              onlineCount: roomService.getOnlineCount(socket.data.roomId),
            });
          }
        }
      } catch (err) {
        console.error('disconnect cleanup error:', err);
      }
      console.log('Socket disconnected:', socket.id);
    });
  });
}

function sanitizeQuestionForParticipant(q) {
  if (!q) return null;
  return {
    id: q.id,
    type: q.type,
    question_text: q.question_text,
    timer_seconds: q.timer_seconds,
    is_quiz: q.is_quiz,
    status: q.status,
    options: (q.options || []).map((o) => ({
      id: o.id,
      option_text: o.option_text,
      option_order: o.option_order,
    })),
    // never include correct_option_id
  };
}

function sanitizeResultsForParticipants(results, question) {
  if (!results) return null;
  // Hide individual correctness details unless quiz results are meant to be shown
  const base = {
    questionId: results.questionId,
    type: results.type,
    totalAnswers: results.totalAnswers,
    options: results.options,
    average: results.average,
    words: results.words,
  };
  // For open text / word cloud we can show aggregated data; individual responses optional
  if (results.type === 'open_text' || results.type === 'word_cloud') {
    // Don't expose other participants' names by default on participant view for privacy
    // Host gets full list
  }
  return base;
}

module.exports = { registerSocketHandlers };
