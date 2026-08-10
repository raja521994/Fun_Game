const { findOne, insert, update, count } = require('../database/db');
const { generateRoomCode, generateId, generateToken } = require('../utils/codes');

function createRoom(title = 'Fun Game Session') {
  let roomCode;
  let attempts = 0;
  while (attempts < 20) {
    roomCode = generateRoomCode();
    const existing = findOne('rooms', (r) => r.room_code === roomCode);
    if (!existing) break;
    attempts++;
  }
  if (attempts >= 20) throw new Error('Could not generate unique room code');

  const room = {
    id: generateId(),
    room_code: roomCode,
    host_token: generateToken(),
    status: 'waiting',
    title: title || 'Fun Game Session',
    created_at: new Date().toISOString(),
    ended_at: null,
  };
  insert('rooms', room);
  return {
    id: room.id,
    roomCode: room.room_code,
    hostToken: room.host_token,
    status: room.status,
    title: room.title,
  };
}

function getRoomByCode(roomCode) {
  return findOne('rooms', (r) => r.room_code === String(roomCode).toUpperCase());
}

function getRoomById(roomId) {
  return findOne('rooms', (r) => r.id === roomId);
}

function getRoomByHostToken(hostToken) {
  return findOne('rooms', (r) => r.host_token === hostToken);
}

function updateRoomStatus(roomId, status) {
  const endedAt = status === 'ended' ? new Date().toISOString() : null;
  update(
    'rooms',
    (r) => r.id === roomId,
    (r) => ({ ...r, status, ended_at: endedAt || r.ended_at })
  );
  return getRoomById(roomId);
}

function getParticipantCount(roomId) {
  return count('participants', (p) => p.room_id === roomId);
}

function getOnlineCount(roomId) {
  return count('participants', (p) => p.room_id === roomId && p.is_online === 1);
}

module.exports = {
  createRoom,
  getRoomByCode,
  getRoomById,
  getRoomByHostToken,
  updateRoomStatus,
  getParticipantCount,
  getOnlineCount,
};
