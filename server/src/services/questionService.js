const { findOne, findMany, insert, update, remove } = require('../database/db');
const { generateId } = require('../utils/codes');
const { calculateScore } = require('../utils/scoring');

const VALID_TYPES = ['multiple_choice', 'word_cloud', 'rating', 'feedback', 'yes_no', 'open_text'];

function createQuestion(roomId, data) {
  const {
    type,
    questionText,
    options = [],
    isQuiz = false,
    correctOptionIndex = null,
    timerSeconds = 0,
    revealAtEnd = false,
  } = data;

  if (!VALID_TYPES.includes(type)) throw new Error('Invalid question type: ' + type);
  if (!questionText || questionText.trim().length === 0) throw new Error('Question text is required');
  if (questionText.length > 500) throw new Error('Question text too long (max 500 characters)');

  const existing = findMany('questions', (q) => q.room_id === roomId);
  const maxOrder = existing.reduce((m, q) => Math.max(m, q.order_number ?? -1), -1);
  const orderNumber = maxOrder + 1;
  const id = generateId();
  let correctOptionId = null;

  insert('questions', {
    id,
    room_id: roomId,
    type,
    question_text: questionText.trim(),
    order_number: orderNumber,
    is_active: 0,
    is_quiz: isQuiz ? 1 : 0,
    correct_option_id: null,
    timer_seconds: timerSeconds || 0,
    reveal_at_end: isQuiz && revealAtEnd ? 1 : 0,
    status: 'draft',
    created_at: new Date().toISOString(),
  });

  if (type === 'multiple_choice' || type === 'yes_no') {
    const opts =
      type === 'yes_no'
        ? [{ text: 'Yes', order: 0 }, { text: 'No', order: 1 }]
        : options.map((o, i) => ({ text: typeof o === 'string' ? o : o.text, order: i }));
    if (type === 'multiple_choice' && opts.length < 2) throw new Error('Multiple choice needs at least 2 options');
    opts.forEach((opt, idx) => {
      if (!opt.text || String(opt.text).trim().length === 0) return;
      const optId = generateId();
      insert('options', {
        id: optId,
        question_id: id,
        option_text: String(opt.text).trim().slice(0, 200),
        option_order: opt.order ?? idx,
      });
      if (isQuiz && correctOptionIndex !== null && correctOptionIndex === idx) correctOptionId = optId;
    });
    if (correctOptionId) update('questions', (q) => q.id === id, { correct_option_id: correctOptionId });
  }

  if (type === 'rating' || type === 'feedback') {
    for (let i = 1; i <= 5; i++) {
      insert('options', {
        id: generateId(),
        question_id: id,
        option_text: String(i),
        option_order: i - 1,
      });
    }
  }

  return getQuestionById(id);
}

function getQuestionById(id) {
  const q = findOne('questions', (x) => x.id === id);
  if (!q) return null;
  const options = findMany('options', (o) => o.question_id === id).sort((a, b) => a.option_order - b.option_order);
  return { ...q, options };
}

function getQuestionsByRoom(roomId) {
  return findMany('questions', (q) => q.room_id === roomId)
    .sort((a, b) => a.order_number - b.order_number)
    .map((q) => {
      const options = findMany('options', (o) => o.question_id === q.id).sort((a, b) => a.option_order - b.option_order);
      return { ...q, options };
    });
}

function getActiveQuestion(roomId) {
  const q = findOne('questions', (x) => x.room_id === roomId && x.is_active === 1);
  if (!q) return null;
  const options = findMany('options', (o) => o.question_id === q.id).sort((a, b) => a.option_order - b.option_order);
  return { ...q, options };
}

function startQuestion(questionId) {
  const q = getQuestionById(questionId);
  if (!q) throw new Error('Question not found');
  update(
    'questions',
    (x) => x.room_id === q.room_id && x.id !== questionId && x.is_active === 1,
    (x) => ({ ...x, is_active: 0, status: x.status === 'active' ? 'stopped' : x.status })
  );
  update('questions', (x) => x.id === questionId, { is_active: 1, status: 'active' });
  return getQuestionById(questionId);
}

function stopQuestion(questionId) {
  update('questions', (x) => x.id === questionId, { status: 'stopped', is_active: 0 });
  return getQuestionById(questionId);
}

function setResultsStatus(questionId) {
  update('questions', (x) => x.id === questionId, { status: 'results', is_active: 0 });
  return getQuestionById(questionId);
}

function submitAnswer({ questionId, participantId, answerText, optionId, responseTimeMs }) {
  const q = getQuestionById(questionId);
  if (!q) throw new Error('Question not found');
  if (q.status !== 'active') throw new Error('Question is not accepting answers');
  const existing = findOne('answers', (a) => a.question_id === questionId && a.participant_id === participantId);
  if (existing) throw new Error('You have already answered this question');

  let isCorrect = null;
  let score = 0;
  let finalOptionId = optionId || null;
  let finalText = answerText ? String(answerText).trim().slice(0, 200) : null;

  if (q.type === 'multiple_choice' || q.type === 'yes_no' || q.type === 'rating' || q.type === 'feedback') {
    if (!optionId) throw new Error('Option is required');
    const opt = q.options.find((o) => o.id === optionId);
    if (!opt) throw new Error('Invalid option');
    finalText = opt.option_text;
    if (q.is_quiz && q.correct_option_id) {
      isCorrect = optionId === q.correct_option_id ? 1 : 0;
      score = calculateScore({ isCorrect: !!isCorrect, responseTimeMs, timerSeconds: q.timer_seconds });
    }
  } else if (q.type === 'word_cloud' || q.type === 'open_text') {
    if (!finalText || finalText.length === 0) throw new Error('Answer text is required');
  }

  const id = generateId();
  insert('answers', {
    id,
    question_id: questionId,
    participant_id: participantId,
    answer_text: finalText,
    option_id: finalOptionId,
    is_correct: isCorrect,
    score,
    response_time_ms: responseTimeMs ?? null,
    submitted_at: new Date().toISOString(),
  });

  return { id, questionId, participantId, answerText: finalText, optionId: finalOptionId, isCorrect, score };
}

function getResults(questionId) {
  const q = getQuestionById(questionId);
  if (!q) throw new Error('Question not found');
  const answers = findMany('answers', (a) => a.question_id === questionId)
    .map((a) => {
      const p = findOne('participants', (x) => x.id === a.participant_id);
      return { ...a, participant_name: p?.name || 'Unknown' };
    })
    .sort((a, b) => (a.submitted_at || '').localeCompare(b.submitted_at || ''));
  const total = answers.length;

  if (q.type === 'multiple_choice' || q.type === 'yes_no' || q.type === 'rating' || q.type === 'feedback') {
    const counts = {};
    q.options.forEach((o) => { counts[o.id] = { optionId: o.id, text: o.option_text, count: 0, percentage: 0 }; });
    answers.forEach((a) => { if (a.option_id && counts[a.option_id]) counts[a.option_id].count++; });
    Object.values(counts).forEach((c) => { c.percentage = total > 0 ? Math.round((c.count / total) * 1000) / 10 : 0; });
    let average = null;
    if ((q.type === 'rating' || q.type === 'feedback') && total > 0) {
      const sum = answers.reduce((acc, a) => acc + (parseInt(a.answer_text, 10) || 0), 0);
      average = Math.round((sum / total) * 10) / 10;
    }
    return {
      questionId, type: q.type, totalAnswers: total, options: Object.values(counts), average,
      answers: q.is_quiz ? answers.map((a) => ({ participantName: a.participant_name, answer: a.answer_text, isCorrect: a.is_correct, score: a.score })) : undefined,
    };
  }

  if (q.type === 'word_cloud') {
    const wordMap = {};
    answers.forEach((a) => {
      const phrase = (a.answer_text || '').trim().toLowerCase();
      if (phrase) wordMap[phrase] = (wordMap[phrase] || 0) + 1;
    });
    const words = Object.entries(wordMap).map(([text, value]) => ({ text, value })).sort((a, b) => b.value - a.value).slice(0, 80);
    return {
      questionId, type: q.type, totalAnswers: total, words,
      responses: answers.map((a) => ({ participantName: a.participant_name, answer: a.answer_text })),
    };
  }

  return {
    questionId, type: q.type, totalAnswers: total,
    responses: answers.map((a) => ({ participantName: a.participant_name, answer: a.answer_text, submittedAt: a.submitted_at })),
  };
}

function getLeaderboard(roomId) {
  const participants = findMany('participants', (p) => p.room_id === roomId);
  const quizQuestionIds = new Set(findMany('questions', (q) => q.room_id === roomId && q.is_quiz === 1).map((q) => q.id));
  const rows = participants.map((p) => {
    const answers = findMany('answers', (a) => a.participant_id === p.id && quizQuestionIds.has(a.question_id));
    return {
      id: p.id, name: p.name,
      total_score: answers.reduce((s, a) => s + (a.score || 0), 0),
      correct_count: answers.filter((a) => a.is_correct === 1).length,
      answer_count: answers.length,
    };
  });
  rows.sort((a, b) => b.total_score - a.total_score || b.correct_count - a.correct_count || a.name.localeCompare(b.name));
  return rows.map((r, idx) => ({
    rank: idx + 1, participantId: r.id, name: r.name, score: r.total_score, correctCount: r.correct_count, answerCount: r.answer_count,
  }));
}

function deleteQuestion(questionId) {
  remove('answers', (a) => a.question_id === questionId);
  remove('options', (o) => o.question_id === questionId);
  remove('questions', (q) => q.id === questionId);
}

function exportExcel(roomId) {
  const XLSX = require('xlsx');
  const questions = getQuestionsByRoom(roomId);
  const participants = findMany('participants', (p) => p.room_id === roomId);
  const pMap = Object.fromEntries(participants.map((p) => [p.id, p]));

  const resultRows = [
    ['Question', 'Type', 'Order', 'Participant', 'Answer', 'Correct', 'Score', 'Submitted at'],
  ];
  const feedbackRows = [
    ['Feedback question', 'Order', 'Participant', 'Rating (1-5)', 'Submitted at'],
  ];

  for (const q of questions) {
    const answers = findMany('answers', (a) => a.question_id === q.id);
    for (const a of answers) {
      const p = pMap[a.participant_id];
      if (q.type === 'feedback') {
        feedbackRows.push([
          q.question_text,
          q.order_number,
          p?.name || '',
          a.answer_text || '',
          a.submitted_at || '',
        ]);
      } else {
        resultRows.push([
          q.question_text,
          q.type,
          q.order_number,
          p?.name || '',
          a.answer_text || '',
          a.is_correct == null ? '' : a.is_correct ? 'Yes' : 'No',
          a.score ?? '',
          a.submitted_at || '',
        ]);
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resultRows), 'Results');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(feedbackRows), 'Feedback');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function exportCsv(roomId) {
  const questions = findMany('questions', (q) => q.room_id === roomId).sort((a, b) => a.order_number - b.order_number);
  const rows = [];
  for (const q of questions) {
    for (const a of findMany('answers', (x) => x.question_id === q.id)) {
      const p = findOne('participants', (x) => x.id === a.participant_id);
      rows.push({ question_text: q.question_text, type: q.type, order_number: q.order_number, participant_name: p?.name || '', answer_text: a.answer_text, is_correct: a.is_correct, score: a.score, submitted_at: a.submitted_at });
    }
  }
  const header = 'Question,Type,Order,Participant,Answer,Correct,Score,Timestamp\n';
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return header + rows.map((r) => [esc(r.question_text), esc(r.type), r.order_number, esc(r.participant_name), esc(r.answer_text), r.is_correct == null ? '' : r.is_correct ? 'Yes' : 'No', r.score ?? '', esc(r.submitted_at)].join(',')).join('\n');
}

module.exports = {
  createQuestion, getQuestionById, getQuestionsByRoom, getActiveQuestion, startQuestion, stopQuestion,
  setResultsStatus, submitAnswer, getResults, getLeaderboard, deleteQuestion, exportCsv, exportExcel, VALID_TYPES,
};
