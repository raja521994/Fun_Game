const roomService = require('../services/roomService');
const participantService = require('../services/participantService');
const questionService = require('../services/questionService');

function createRoom(req, res) {
  try {
    const title = (req.body.title || 'Fun Game Session').toString().slice(0, 100);
    const room = roomService.createRoom(title);
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
      roomId: room.id,
      roomCode: room.room_code,
      hostToken: room.host_token,
      status: room.status,
      title: room.title,
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

    const csv = questionService.exportCsv(room.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="fun-game-${room.room_code}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('exportResults error:', err);
    res.status(500).json({ error: 'Failed to export results' });
  }
}

module.exports = {
  createRoom,
  getRoomByCode,
  getHostRoom,
  endRoom,
  exportResults,
};
