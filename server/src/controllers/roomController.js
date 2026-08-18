const roomService = require('../services/roomService');
const participantService = require('../services/participantService');
const questionService = require('../services/questionService');

function createRoom(req, res) {
  try {
    const title = (req.body.title || 'Fun Game Session').toString().slice(0, 100);
    const ownerId = req.user?.id || null;
    const room = roomService.createRoom(title, ownerId);
    res.status(201).json({
      roomId: room.id,
      roomCode: room.roomCode,
      hostToken: room.hostToken,
      status: room.status,
      title: room.title,
    });
  } catch (err) {
    console.error('createRoom error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
}

function listMyRooms(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Login required' });
    }
    const rooms = roomService.listRoomsByOwner(req.user.id);
    res.json({ rooms });
  } catch (err) {
    console.error('listMyRooms error:', err);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
}

function getRoomByCode(req, res) {
  try {
    const code = (req.params.code || '').toUpperCase();
    const room = roomService.getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.status === 'ended') {
      return res.status(410).json({ error: 'This game has ended' });
    }
    const participantCount = roomService.getParticipantCount(room.id);
    res.json({
      roomId: room.id,
      roomCode: room.room_code,
      status: room.status,
      title: room.title,
      participantCount,
    });
  } catch (err) {
    console.error('getRoomByCode error:', err);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
}

function getHostRoom(req, res) {
  try {
    const token = req.params.token || req.headers['x-host-token'];
    if (!token) return res.status(401).json({ error: 'Host token required' });

    const room = roomService.getRoomByHostToken(token);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const participants = participantService.getParticipants(room.id);
    const questions = questionService.getQuestionsByRoom(room.id);
    const activeQuestion = questionService.getActiveQuestion(room.id);
    const leaderboard = questionService.getLeaderboard(room.id);

    res.json({
      room: {
        id: room.id,
        roomCode: room.room_code,
        status: room.status,
        title: room.title,
        revealAnswersAtEnd: room.reveal_answers_at_end !== 0 && room.reveal_answers_at_end !== false,
        feedbackEnabled: !!(room.feedback_enabled === 1 || room.feedback_enabled === true),
        thankYouMessage: room.thank_you_message || 'Thank you for playing!',
      },
      participants,
      questions,
      activeQuestion,
      leaderboard,
      participantCount: participants.length,
      onlineCount: participants.filter((p) => p.is_online).length,
    });
  } catch (err) {
    console.error('getHostRoom error:', err);
    res.status(500).json({ error: 'Failed to fetch host room' });
  }
}

function endRoom(req, res) {
  try {
    const token = req.headers['x-host-token'] || req.body.hostToken;
    const room = roomService.getRoomByHostToken(token);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    roomService.updateRoomStatus(room.id, 'ended');
    res.json({ success: true, status: 'ended' });
  } catch (err) {
    console.error('endRoom error:', err);
    res.status(500).json({ error: 'Failed to end room' });
  }
}

function exportResults(req, res) {
  try {
    const token = req.headers['x-host-token'] || req.query.hostToken;
    const room = roomService.getRoomByHostToken(token);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const buf = questionService.exportExcel(room.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="fun-game-${room.room_code}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('exportResults error:', err);
    res.status(500).json({ error: 'Failed to export results' });
  }
}

function updateSettings(req, res) {
  try {
    const token = req.headers['x-host-token'] || req.body.hostToken;
    const room = roomService.getRoomByHostToken(token);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const updated = roomService.updateRoomSettings(room.id, {
      revealAnswersAtEnd: req.body.revealAnswersAtEnd,
      feedbackEnabled: req.body.feedbackEnabled,
      thankYouMessage: req.body.thankYouMessage,
    });
    res.json({
      success: true,
      room: {
        id: updated.id,
        roomCode: updated.room_code,
        status: updated.status,
        title: updated.title,
        revealAnswersAtEnd: updated.reveal_answers_at_end !== 0 && updated.reveal_answers_at_end !== false,
        feedbackEnabled: !!(updated.feedback_enabled === 1 || updated.feedback_enabled === true),
        thankYouMessage: updated.thank_you_message || 'Thank you for playing!',
      },
    });
  } catch (err) {
    console.error('updateSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

function deleteRoom(req, res) {
  try {
    const hostToken = req.body?.hostToken || req.headers['x-host-token'] || req.params.token;
    const roomId = req.params.roomId;
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Login required' });
    }
    if (roomId) {
      roomService.deleteRoom(roomId, req.user.id);
    } else if (hostToken) {
      roomService.deleteRoomByHostToken(hostToken, req.user.id);
    } else {
      return res.status(400).json({ error: 'Room id or host token required' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('deleteRoom error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to delete room' });
  }
}

module.exports = {
  createRoom,
  listMyRooms,
  getRoomByCode,
  getHostRoom,
  endRoom,
  exportResults,
  deleteRoom,
  updateSettings,
};

