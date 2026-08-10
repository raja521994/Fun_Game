const { findOne, findMany, insert, update } = require('../database/db');
const { generateId } = require('../utils/codes');

function joinRoom(roomId, name, socketId) {
  const existing = findOne(
    'participants',
    (p) => p.room_id === roomId && p.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    update(
      'participants',
      (p) => p.id === existing.id,
      (p) => ({
        ...p,
        socket_id: socketId,
        is_online: 1,
        last_seen: new Date().toISOString(),
      })
    );
    return { ...existing, socket_id: socketId, is_online: 1, reconnected: true };
  }

  const row = {
    id: generateId(),
    room_id: roomId,
    name,
    socket_id: socketId,
    is_online: 1,
    joined_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  };
  insert('participants', row);
  return { ...row, reconnected: false };
}

function setOfflineBySocket(socketId) {
  const p = findOne('participants', (x) => x.socket_id === socketId);
  if (p) {
    update(
      'participants',
      (x) => x.id === p.id,
      (x) => ({
        ...x,
        is_online: 0,
        last_seen: new Date().toISOString(),
        socket_id: null,
      })
    );
  }
  return p;
}

function updateSocket(participantId, socketId) {
  update(
    'participants',
    (p) => p.id === participantId,
    (p) => ({
      ...p,
      socket_id: socketId,
      is_online: 1,
      last_seen: new Date().toISOString(),
    })
  );
}

function getParticipants(roomId) {
  return findMany('participants', (p) => p.room_id === roomId)
    .sort((a, b) => (a.joined_at || '').localeCompare(b.joined_at || ''))
    .map(({ id, name, is_online, joined_at, last_seen }) => ({
      id,
      name,
      is_online,
      joined_at,
      last_seen,
    }));
}

function getParticipantById(id) {
  return findOne('participants', (p) => p.id === id);
}

function getParticipantAnswerStatus(roomId, questionId) {
  const participants = getParticipants(roomId);
  const answeredIds = new Set(
    findMany('answers', (a) => a.question_id === questionId).map((a) => a.participant_id)
  );
  return participants.map((p) => ({
    ...p,
    hasAnswered: answeredIds.has(p.id),
  }));
}

module.exports = {
  joinRoom,
  setOfflineBySocket,
  updateSocket,
  getParticipants,
  getParticipantById,
  getParticipantAnswerStatus,
};
