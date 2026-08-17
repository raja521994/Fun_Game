const { findOne, findMany, insert, update, count, remove } = require('../database/db');
const { generateRoomCode, generateId, generateToken } = require('../utils/codes');

function createRoom(title = 'Fun Game Session', ownerUserId = null) {
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
    owner_user_id: ownerUserId || null,
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
    ownerUserId: room.owner_user_id,
  };
}

function listRoomsByOwner(userId) {
  if (!userId) return [];
  const rooms = findMany('rooms', (r) => r.owner_user_id === userId);
  rooms.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return rooms.map((r) => ({
    roomId: r.id,
    roomCode: r.room_code,
    hostToken: r.host_token,
    status: r.status,
    title: r.title,
    createdAt: r.created_at,
  }));
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

function deleteRoom(roomId, ownerUserId) {
  const room = getRoomById(roomId);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  // Only owner can delete (or if no owner set, allow host token path via controller)
  if (ownerUserId && room.owner_user_id && room.owner_user_id !== ownerUserId) {
    const err = new Error('You can only delete your own rooms');
    err.status = 403;
    throw err;
  }

  const questionIds = findMany('questions', (q) => q.room_id === roomId).map((q) => q.id);
  if (questionIds.length) {
    remove('options', (o) => questionIds.includes(o.question_id));
    remove('answers', (a) => questionIds.includes(a.question_id));
    remove('questions', (q) => q.room_id === roomId);
  }
  remove('participants', (p) => p.room_id === roomId);
  remove('rooms', (r) => r.id === roomId);
  return true;
}

function deleteRoomByHostToken(hostToken, ownerUserId) {
  const room = getRoomByHostToken(hostToken);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  return deleteRoom(room.id, ownerUserId);
}

module.exports = {
  createRoom,
  listRoomsByOwner,
  getRoomByCode,
  getRoomById,
  getRoomByHostToken,
  updateRoomStatus,
  getParticipantCount,
  getOnlineCount,
  deleteRoom,
  deleteRoomByHostToken,
};
