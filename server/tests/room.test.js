const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, '../data/test-fungame.db.json');
process.env.DATABASE_URL = testDbPath;
process.env.NODE_ENV = 'test';

if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const { initSchema } = require('../src/database/db');
const roomService = require('../src/services/roomService');
const participantService = require('../src/services/participantService');
const questionService = require('../src/services/questionService');

describe('Room Service', () => {
  before(() => { initSchema(); });

  it('creates a room with unique code and host token', () => {
    const room = roomService.createRoom('Test Session');
    assert.ok(room.id);
    assert.strictEqual(room.roomCode.length, 6);
    assert.ok(room.hostToken);
    assert.strictEqual(room.status, 'waiting');
  });

  it('finds room by code', () => {
    const room = roomService.createRoom();
    const found = roomService.getRoomByCode(room.roomCode);
    assert.ok(found);
    assert.strictEqual(found.room_code, room.roomCode);
  });

  it('returns undefined for invalid room code', () => {
    assert.strictEqual(roomService.getRoomByCode('XXXXXX'), undefined);
  });

  it('finds room by host token', () => {
    const room = roomService.createRoom();
    const found = roomService.getRoomByHostToken(room.hostToken);
    assert.ok(found);
    assert.strictEqual(found.id, room.id);
  });
});

describe('Participant Service', () => {
  let room;
  before(() => { room = roomService.createRoom(); });

  it('joins a room with a name', () => {
    const p = participantService.joinRoom(room.id, 'Alice', 'socket-1');
    assert.ok(p.id);
    assert.strictEqual(p.name, 'Alice');
    assert.strictEqual(p.reconnected, false);
  });

  it('reconnects same name', () => {
    const p = participantService.joinRoom(room.id, 'Alice', 'socket-2');
    assert.strictEqual(p.reconnected, true);
  });

  it('lists participants', () => {
    participantService.joinRoom(room.id, 'Bob', 'socket-3');
    assert.ok(participantService.getParticipants(room.id).length >= 2);
  });
});

describe('Question Service', () => {
  let room;
  before(() => { room = roomService.createRoom(); });

  it('creates multiple choice question', () => {
    const q = questionService.createQuestion(room.id, {
      type: 'multiple_choice',
      questionText: 'Favorite color?',
      options: ['Red', 'Blue', 'Green'],
      isQuiz: true,
      correctOptionIndex: 1,
    });
    assert.ok(q.id);
    assert.strictEqual(q.options.length, 3);
    assert.ok(q.correct_option_id);
  });

  it('creates yes/no question', () => {
    const q = questionService.createQuestion(room.id, {
      type: 'yes_no',
      questionText: 'Do you like pizza?',
    });
    assert.strictEqual(q.options.length, 2);
  });

  it('starts and stops question', () => {
    const q = questionService.createQuestion(room.id, { type: 'rating', questionText: 'Rate this' });
    const started = questionService.startQuestion(q.id);
    assert.strictEqual(started.status, 'active');
    const stopped = questionService.stopQuestion(q.id);
    assert.strictEqual(stopped.status, 'stopped');
  });

  it('submits answer and prevents duplicates', () => {
    const q = questionService.createQuestion(room.id, {
      type: 'multiple_choice',
      questionText: 'Pick one',
      options: ['A', 'B'],
      isQuiz: true,
      correctOptionIndex: 0,
      timerSeconds: 30,
    });
    questionService.startQuestion(q.id);
    const p = participantService.joinRoom(room.id, 'Charlie', 'sock-c');
    const ans = questionService.submitAnswer({
      questionId: q.id,
      participantId: p.id,
      optionId: q.options[0].id,
      responseTimeMs: 5000,
    });
    assert.strictEqual(ans.isCorrect, 1);
    assert.ok(ans.score > 0);
    assert.throws(() => {
      questionService.submitAnswer({ questionId: q.id, participantId: p.id, optionId: q.options[0].id });
    }, /already answered/i);
  });

  it('computes results', () => {
    const q = questionService.createQuestion(room.id, { type: 'yes_no', questionText: 'Yes or no?' });
    questionService.startQuestion(q.id);
    const p = participantService.joinRoom(room.id, 'Dana', 'sock-d');
    const yesOpt = q.options.find((o) => o.option_text === 'Yes');
    questionService.submitAnswer({ questionId: q.id, participantId: p.id, optionId: yesOpt.id });
    const results = questionService.getResults(q.id);
    assert.strictEqual(results.totalAnswers, 1);
  });

  it('builds leaderboard', () => {
    assert.ok(Array.isArray(questionService.getLeaderboard(room.id)));
  });
});
