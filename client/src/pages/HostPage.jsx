import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Users,
  Play,
  Square,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  Monitor,
  X,
  Copy,
  Check,
  Trash2,
  LogOut,
} from 'lucide-react';
import api from '../services/api';
import { connectSocket, emitWithAck, getSocket } from '../services/socket';
import QuestionForm from '../components/QuestionForm';
import ResultsChart from '../components/ResultsChart';
import Leaderboard from '../components/Leaderboard';

export default function HostPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [results, setResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [creatingQ, setCreatingQ] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [answerStatus, setAnswerStatus] = useState([]);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const [timerLeft, setTimerLeft] = useState(null);

  const refreshFromHost = useCallback(async () => {
    try {
      connectSocket();
      const res = await emitWithAck('host_join', { hostToken: token });
      setRoom(res.room);
      setParticipants(res.participants || []);
      setQuestions(res.questions || []);
      setActiveQuestion(res.activeQuestion || null);
      setLeaderboard(res.leaderboard || []);
      if (res.activeQuestion) {
        const idx = (res.questions || []).findIndex((q) => q.id === res.activeQuestion.id);
        if (idx >= 0) setCurrentIndex(idx);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Could not connect as host');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshFromHost();
    const socket = getSocket();

    socket.on('participant_joined', ({ participant }) => {
      setParticipants((prev) => {
        const exists = prev.find((p) => p.id === participant.id);
        if (exists) {
          return prev.map((p) => (p.id === participant.id ? { ...p, is_online: 1 } : p));
        }
        return [...prev, participant];
      });
    });

    socket.on('participant_left', ({ participantId }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, is_online: 0 } : p))
      );
    });

    socket.on('answer_received', ({ results: r, answerStatus: as }) => {
      setResults(r);
      if (as) setAnswerStatus(as);
    });

    socket.on('results_updated', ({ results: r, leaderboard: lb }) => {
      setResults(r);
      if (lb) setLeaderboard(lb);
    });

    socket.on('question_started_host', ({ question, startedAt }) => {
      setActiveQuestion(question);
      setResults(null);
      startedAtRef.current = startedAt;
      if (question.timer_seconds > 0) setTimerLeft(question.timer_seconds);
    });

    socket.on('game_ended', () => {
      setRoom((r) => (r ? { ...r, status: 'ended' } : r));
    });

    return () => {
      socket.off('participant_joined');
      socket.off('participant_left');
      socket.off('answer_received');
      socket.off('results_updated');
      socket.off('question_started_host');
      socket.off('game_ended');
    };
  }, [refreshFromHost]);

  useEffect(() => {
    if (!activeQuestion?.timer_seconds || activeQuestion.status !== 'active' || !startedAtRef.current) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const left = Math.max(0, Math.ceil(activeQuestion.timer_seconds - elapsed));
      setTimerLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        emitWithAck('timer_expired', { questionId: activeQuestion.id }).catch(() => {});
      }
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [activeQuestion]);

  const handleCreateQuestion = async (data) => {
    setCreatingQ(true);
    try {
      const q = await api.createQuestion(token, data);
      setQuestions((prev) => [...prev, q]);
      setShowForm(false);
      setCurrentIndex(questions.length);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingQ(false);
    }
  };

  const handleStart = async () => {
    const q = questions[currentIndex];
    if (!q) return;
    try {
      await emitWithAck('start_question', { questionId: q.id });
      setActiveQuestion({ ...q, status: 'active', is_active: 1 });
      setResults(null);
      startedAtRef.current = Date.now();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStop = async () => {
    if (!activeQuestion) return;
    try {
      const res = await emitWithAck('stop_question', { questionId: activeQuestion.id });
      setActiveQuestion((q) => (q ? { ...q, status: 'stopped', is_active: 0 } : q));
      setResults(res.results);
      setTimerLeft(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleShowResults = async () => {
    const q = activeQuestion || questions[currentIndex];
    if (!q) return;
    try {
      const res = await emitWithAck('show_results', { questionId: q.id });
      setResults(res.results);
      if (res.leaderboard) setLeaderboard(res.leaderboard);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEndGame = async () => {
    if (!confirm('End this game for everyone?')) return;
    try {
      await emitWithAck('end_game');
      await api.endRoom(token);
      setRoom((r) => (r ? { ...r, status: 'ended' } : r));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteQuestion = async (qid) => {
    if (!confirm('Delete this question?')) return;
    try {
      await api.deleteQuestion(token, qid);
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
      if (activeQuestion?.id === qid) setActiveQuestion(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const copyCode = () => {
    if (room?.roomCode) {
      navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onlineCount = participants.filter((p) => p.is_online).length;
  const currentQ = questions[currentIndex] || null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 animate-pulse-soft">Loading host dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link to="/" className="btn-primary">Go home</Link>
      </div>
    );
  }

  if (presentMode) {
    const roomCode = room?.roomCode || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const joinUrl = roomCode ? `${origin}/join/${roomCode}` : origin;
    const qrSrc = joinUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(joinUrl)}`
      : '';
    const showLobby = !results && activeQuestion?.status !== 'active';

    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex flex-col z-50">
        <div className="flex items-center justify-between px-6 py-3 bg-black/30">
          <div className="flex items-center gap-4">
            <span className="font-display font-bold text-lg">Fun Game</span>
            <span className="font-mono tracking-widest bg-white/10 px-3 py-1 rounded-lg text-sm">
              {roomCode}
            </span>
            <span className="text-sm text-white/60 flex items-center gap-1">
              <Users className="w-4 h-4" /> {onlineCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {timerLeft != null && activeQuestion?.status === 'active' && (
              <span className={`text-2xl font-bold tabular-nums ${timerLeft <= 5 ? 'text-red-400' : ''}`}>
                {timerLeft}s
              </span>
            )}
            <button onClick={() => setPresentMode(false)} className="btn-ghost text-white hover:bg-white/10">
              <X className="w-5 h-5" /> Exit present
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row items-stretch justify-center gap-8 px-6 py-6 overflow-auto">
          <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            {showLobby ? (
              <div className="text-center max-w-xl">
                <p className="text-white/50 text-sm uppercase tracking-widest mb-3">Waiting for players</p>
                <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Join this game</h1>
                <p className="text-white/60 mb-8">
                  Scan the QR code or open the link and enter the room code
                </p>
              </div>
            ) : (
              <>
                {(activeQuestion || currentQ) && (
                  <h1 className="font-display text-3xl md:text-5xl font-bold text-center mb-10 max-w-4xl leading-tight">
                    {(activeQuestion || currentQ).question_text}
                  </h1>
                )}
                {results ? (
                  <div className="w-full max-w-3xl bg-white text-slate-900 rounded-3xl p-8 shadow-2xl">
                    <ResultsChart results={results} presentMode />
                    {leaderboard.length > 0 && (activeQuestion || currentQ)?.is_quiz === 1 && (
                      <div className="mt-8 border-t border-slate-100 pt-6">
                        <Leaderboard entries={leaderboard} presentMode />
                      </div>
                    )}
                  </div>
                ) : activeQuestion?.status === 'active' ? (
                  <p className="text-xl text-white/50 animate-pulse-soft">Collecting answers…</p>
                ) : null}
              </>
            )}
          </div>

          <div
            className={`shrink-0 flex flex-col items-center justify-center ${
              showLobby ? 'w-full max-w-md mx-auto' : 'lg:w-72'
            }`}
          >
            <div className="bg-white rounded-3xl p-6 text-slate-900 shadow-2xl w-full max-w-sm">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-600 mb-3">
                Scan to join
              </p>
              {qrSrc ? (
                <img
                  src={qrSrc}
                  alt={`QR code to join room ${roomCode}`}
                  className="w-full max-w-[240px] mx-auto rounded-xl bg-white"
                  width={240}
                  height={240}
                />
              ) : (
                <div className="w-60 h-60 mx-auto bg-slate-100 rounded-xl" />
              )}
              <div className="mt-5 text-center space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Or visit</p>
                  <p className="text-sm font-medium text-brand-700 break-all leading-snug">
                    {origin || 'this website'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Then join with code</p>
                  <p className="font-mono text-3xl font-bold tracking-[0.2em] text-slate-900">
                    {roomCode}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-3 py-4 bg-black/20">
          <button onClick={handleStart} className="btn-accent" disabled={!currentQ}>
            <Play className="w-4 h-4" /> Start
          </button>
          <button
            onClick={handleStop}
            className="btn bg-white/15 text-white hover:bg-white/25"
            disabled={!activeQuestion || activeQuestion.status !== 'active'}
          >
            <Square className="w-4 h-4" /> Stop
          </button>
          <button onClick={handleShowResults} className="btn bg-white/15 text-white hover:bg-white/25">
            <BarChart3 className="w-4 h-4" /> Results
          </button>
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="btn bg-white/15 text-white hover:bg-white/25"
            disabled={currentIndex <= 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="btn bg-white/15 text-white hover:bg-white/25"
            disabled={currentIndex >= questions.length - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-dvh">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display font-bold text-brand-700">Fun Game</Link>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 bg-brand-50 text-brand-800 font-mono font-bold tracking-widest px-3 py-1.5 rounded-lg text-sm hover:bg-brand-100 transition"
              title="Copy room code"
            >
              {room?.roomCode}
              {copied ? <Check className="w-3.5 h-3.5 text-accent-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="font-semibold text-slate-700">{onlineCount}</span>
              <span className="text-slate-400">/ {participants.length} online</span>
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              room?.status === 'active' ? 'bg-accent-500/15 text-accent-600'
              : room?.status === 'ended' ? 'bg-red-100 text-red-600'
              : 'bg-slate-100 text-slate-500'
            }`}>
              {room?.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPresentMode(true)} className="btn-secondary text-sm">
              <Monitor className="w-4 h-4" /> Present
            </button>
            <a href={api.exportCsvUrl(token)} className="btn-secondary text-sm" download>
              <Download className="w-4 h-4" /> Export CSV
            </a>
            <button onClick={handleEndGame} className="btn-danger text-sm">
              <LogOut className="w-4 h-4" /> End Game
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-4 py-6 grid lg:grid-cols-12 gap-6 flex-1">
        <aside className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-slate-800">Questions</h2>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2 px-3">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {showForm && (
            <QuestionForm onSubmit={handleCreateQuestion} onCancel={() => setShowForm(false)} loading={creatingQ} />
          )}
          <div className="space-y-2">
            {questions.length === 0 && !showForm && (
              <p className="text-sm text-slate-400 text-center py-8">No questions yet. Add one to get started.</p>
            )}
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => { setCurrentIndex(i); setResults(null); }}
                className={`w-full text-left card p-3 transition ${
                  i === currentIndex ? 'ring-2 ring-brand-500 border-brand-200' : 'hover:border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 capitalize mb-0.5">
                      {q.type.replace('_', ' ')}{q.is_quiz ? ' · Quiz' : ''}
                    </p>
                    <p className="text-sm font-medium text-slate-800 truncate">{q.question_text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id); }}
                    className="text-slate-300 hover:text-red-500 p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {q.status === 'active' && (
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-accent-600 bg-accent-500/10 px-1.5 py-0.5 rounded">
                    Live
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="lg:col-span-6 space-y-4">
          {currentQ ? (
            <div className="card p-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Question {currentIndex + 1} of {questions.length}
                {timerLeft != null && activeQuestion?.status === 'active' && (
                  <span className={`ml-3 tabular-nums ${timerLeft <= 5 ? 'text-red-500' : 'text-brand-600'}`}>
                    ⏱ {timerLeft}s
                  </span>
                )}
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 mb-6">{currentQ.question_text}</h2>
              {currentQ.options?.length > 0 && (
                <ul className="space-y-1.5 mb-6">
                  {currentQ.options.map((o) => (
                    <li
                      key={o.id}
                      className={`text-sm px-3 py-2 rounded-lg ${
                        currentQ.correct_option_id === o.id
                          ? 'bg-accent-500/10 text-accent-700 font-medium'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {o.option_text}
                      {currentQ.correct_option_id === o.id && ' ✓'}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleStart}
                  className="btn-accent"
                  disabled={activeQuestion?.status === 'active' && activeQuestion?.id === currentQ.id}
                >
                  <Play className="w-4 h-4" /> Start
                </button>
                <button
                  onClick={handleStop}
                  className="btn-secondary"
                  disabled={!activeQuestion || activeQuestion.status !== 'active'}
                >
                  <Square className="w-4 h-4" /> Stop
                </button>
                <button onClick={handleShowResults} className="btn-secondary">
                  <BarChart3 className="w-4 h-4" /> Show Results
                </button>
                <button onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} className="btn-ghost" disabled={currentIndex <= 0}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))} className="btn-ghost" disabled={currentIndex >= questions.length - 1}>
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center text-slate-400">
              <p>Select or create a question to begin</p>
            </div>
          )}

          {results && (
            <div className="card p-6 animate-fade-in">
              <h3 className="font-display font-bold text-slate-800 mb-4">Live Results</h3>
              <ResultsChart results={results} />
            </div>
          )}

          {leaderboard.length > 0 && (
            <div className="card p-6">
              <Leaderboard entries={leaderboard} />
            </div>
          )}
        </main>

        <aside className="lg:col-span-3">
          <div className="card p-4 sticky top-20">
            <h2 className="font-display font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Participants
            </h2>
            {participants.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Share code <strong className="font-mono">{room?.roomCode}</strong> with your audience
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {participants.map((p) => {
                  const answered = answerStatus.find((a) => a.id === p.id)?.hasAnswered;
                  return (
                    <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.is_online ? 'bg-accent-500' : 'bg-slate-300'}`} />
                      <span className="flex-1 truncate text-slate-700">{p.name}</span>
                      {activeQuestion?.status === 'active' && (
                        <span className={`text-[10px] ${answered ? 'text-accent-600' : 'text-slate-400'}`}>
                          {answered ? '✓' : '…'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
