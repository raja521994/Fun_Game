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
import { upsertHostRoom, updateHostRoom } from '../utils/hostRooms';

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
  const [showFinalResults, setShowFinalResults] = useState(false);
  const [betweenQuestions, setBetweenQuestions] = useState(false);
  const [readyForResults, setReadyForResults] = useState(false);
  const [answerReview, setAnswerReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const [timerLeft, setTimerLeft] = useState(null);
  const presentModeRef = useRef(false);
  const currentIndexRef = useRef(0);
  const questionsRef = useRef([]);
  const advancingRef = useRef(false);

  useEffect(() => {
    presentModeRef.current = presentMode;
  }, [presentMode]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  const broadcastPhase = useCallback(async (phase, extra = {}) => {
    try {
      await emitWithAck('present_phase', { phase, ...extra });
    } catch {
      /* non-fatal */
    }
  }, []);

  const startQuestionByIndex = useCallback(async (index) => {
    const list = questionsRef.current;
    const q = list[index];
    if (!q) return;
    try {
      await emitWithAck('start_question', { questionId: q.id });
      setCurrentIndex(index);
      setActiveQuestion({ ...q, status: 'active', is_active: 1 });
      setResults(null);
      setShowFinalResults(false);
      setBetweenQuestions(false);
      setReadyForResults(false);
      broadcastPhase('live');
      startedAtRef.current = Date.now();
      if (q.timer_seconds > 0) setTimerLeft(q.timer_seconds);
      else setTimerLeft(null);
    } catch (err) {
      alert(err.message);
    }
  }, [broadcastPhase]);

  const handleTimerComplete = useCallback(async (questionId) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      try {
        await emitWithAck('timer_expired', { questionId });
      } catch {
        /* already stopped */
      }

      const idx = currentIndexRef.current;
      const list = questionsRef.current;
      const nextIdx = idx + 1;

      setActiveQuestion((q) => (q ? { ...q, status: 'stopped', is_active: 0 } : q));
      setTimerLeft(null);
      setResults(null);
      setAnswerStatus([]);

      if (presentModeRef.current && nextIdx < list.length) {
        // Pause — host must click next manually
        setBetweenQuestions(true);
        setShowFinalResults(false);
        setCurrentIndex(nextIdx);
        try { await emitWithAck('present_phase', { phase: 'between' }); } catch { /* */ }
      } else if (presentModeRef.current) {
        setBetweenQuestions(false);
        setReadyForResults(true);
        setShowFinalResults(false);
        try { await emitWithAck('present_phase', { phase: 'ready_results' }); } catch { /* */ }
        try {
          const res = await emitWithAck('show_results', { questionId });
          if (res.leaderboard) setLeaderboard(res.leaderboard);
          setResults(null);
        } catch {
          /* ok */
        }
      }
    } finally {
      advancingRef.current = false;
    }
  }, []);

  const refreshFromHost = useCallback(async () => {
    try {
      connectSocket();
      const res = await emitWithAck('host_join', { hostToken: token });
      setRoom(res.room);
      if (res.room) {
        upsertHostRoom({
          hostToken: token,
          roomCode: res.room.roomCode || res.room.code,
          roomId: res.room.id,
          title: res.room.title,
          status: res.room.status,
        });
      }
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

    socket.on('results_updated', ({ results: r, leaderboard: lb, reason }) => {
      if (lb) setLeaderboard(lb);
      // In present mode, timer auto-advance handles next step — only keep results if final
      if (reason === 'timer' && presentModeRef.current) {
        return;
      }
      setResults(r);
    });

    socket.on('question_started_host', ({ question, startedAt }) => {
      setActiveQuestion(question);
      setResults(null);
      setShowFinalResults(false);
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
        handleTimerComplete(activeQuestion.id);
      }
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [activeQuestion, handleTimerComplete]);

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
    await startQuestionByIndex(currentIndex);
  };

  const handleStop = async () => {
    if (!activeQuestion) return;
    try {
      const res = await emitWithAck('stop_question', { questionId: activeQuestion.id });
      setActiveQuestion((q) => (q ? { ...q, status: 'stopped', is_active: 0 } : q));
      setTimerLeft(null);

      if (presentModeRef.current) {
        const idx = currentIndexRef.current;
        const list = questionsRef.current;
        const nextIdx = idx + 1;
        setResults(null);
        setAnswerStatus([]);
        if (nextIdx < list.length) {
          setBetweenQuestions(true);
          setShowFinalResults(false);
          setCurrentIndex(nextIdx);
          try { await emitWithAck('present_phase', { phase: 'between' }); } catch { /* */ }
        } else {
          setBetweenQuestions(false);
          setReadyForResults(true);
          setShowFinalResults(false);
          try { await emitWithAck('present_phase', { phase: 'ready_results' }); } catch { /* */ }
          if (res.leaderboard) setLeaderboard(res.leaderboard);
          else {
            try {
              const r2 = await emitWithAck('show_results', { questionId: activeQuestion.id });
              if (r2.leaderboard) setLeaderboard(r2.leaderboard);
            } catch { /* ok */ }
          }
        }
      } else {
        setResults(res.results);
      }
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
      setShowFinalResults(true);
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
      updateHostRoom(token, { status: 'ended' });
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
  const isLive = activeQuestion?.status === 'active';

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

  const saveRoomSetting = async (patch) => {
    try {
      const res = await api.updateRoomSettings(token, patch);
      if (res.room) setRoom((r) => ({ ...r, ...res.room }));
    } catch (err) {
      alert(err.message || 'Could not save setting');
    }
  };

  // —— PRESENT MODE ——
  if (presentMode) {
    const roomCode = room?.roomCode || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const joinUrl = roomCode ? `${origin}/join/${roomCode}` : origin;
    const qrSrc = joinUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(joinUrl)}`
      : '';
    const showLobby = !isLive && !showFinalResults && !betweenQuestions && !readyForResults && !answerReview;

    // Build chart data even with 0 answers
    const liveChartResults = (() => {
      if (results) return results;
      const q = activeQuestion || currentQ;
      if (!q) return null;
      const opts = q.options || [];
      return {
        type: q.type || 'multiple_choice',
        options: opts.map((o) => ({
          text: o.option_text || o.text || 'Option',
          count: 0,
          percentage: 0,
        })),
        totalAnswers: 0,
        average: null,
      };
    })();

    const revealAtEnd = room?.revealAnswersAtEnd !== false;
    const quizQuestions = revealAtEnd
      ? questions.filter(
          (q) => q.is_quiz && q.correct_option_id && (q.options || []).length
        )
      : [];

    const broadcastReview = (idx) => {
      const q = quizQuestions[idx];
      if (!q) return;
      const correct = (q.options || []).find((o) => o.id === q.correct_option_id);
      emitWithAck('present_phase', {
        phase: 'answer_review',
        review: {
          index: idx,
          total: quizQuestions.length,
          questionText: q.question_text,
          correctText: correct?.option_text || correct?.text || '',
          options: (q.options || []).map((o) => ({
            text: o.option_text || o.text,
            isCorrect: o.id === q.correct_option_id,
          })),
          type: q.type,
        },
      }).catch(() => {});
    };

    const goNext = () => {
      if (readyForResults) {
        setReadyForResults(false);
        setShowFinalResults(true);
        emitWithAck('present_phase', { phase: 'final_scores' }).catch(() => {});
        return;
      }
      if (showFinalResults && !answerReview) {
        if (quizQuestions.length === 0) return;
        setAnswerReview(true);
        setReviewIndex(0);
        setShowFinalResults(false);
        broadcastReview(0);
        return;
      }
      if (answerReview) {
        if (reviewIndex < quizQuestions.length - 1) {
          const next = reviewIndex + 1;
          setReviewIndex(next);
          broadcastReview(next);
        }
        return;
      }
      if (betweenQuestions) {
        startQuestionByIndex(currentIndex);
        return;
      }
      if (!isLive && currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    };

    const goPrev = () => {
      if (answerReview) {
        if (reviewIndex > 0) {
          const prev = reviewIndex - 1;
          setReviewIndex(prev);
          broadcastReview(prev);
        } else {
          setAnswerReview(false);
          setShowFinalResults(true);
          emitWithAck('present_phase', { phase: 'final_scores' }).catch(() => {});
        }
        return;
      }
      if (readyForResults) {
        setReadyForResults(false);
        return;
      }
      if (betweenQuestions) {
        setBetweenQuestions(false);
        setCurrentIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (!isLive && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      }
    };

    const JoinCard = ({ compact = false }) => (
      <div
        className={`bg-white rounded-2xl text-slate-900 shadow-xl shrink-0 ${
          compact ? 'p-2 w-[110px]' : 'p-4 w-[200px]'
        }`}
      >
        <p className={`text-center font-semibold uppercase tracking-wider text-brand-600 ${compact ? 'text-[8px] mb-1' : 'text-[10px] mb-2'}`}>
          Scan to join
        </p>
        {qrSrc && (
          <img
            src={qrSrc}
            alt={`QR ${roomCode}`}
            className="w-full rounded-lg"
            width={compact ? 90 : 160}
            height={compact ? 90 : 160}
          />
        )}
        <p className={`font-mono text-center font-bold tracking-widest mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {roomCode}
        </p>
        {!compact && (
          <p className="text-[10px] text-slate-500 text-center mt-1 break-all leading-tight">{origin}</p>
        )}
      </div>
    );

    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex flex-col z-50 overflow-hidden h-[100dvh]">
        <div className="flex items-center justify-between px-4 py-2 bg-black/30 shrink-0 h-12">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display font-bold text-base">Fun Game</span>
            <span className="font-mono tracking-widest bg-white/10 px-2 py-0.5 rounded text-xs">{roomCode}</span>
            <span className="text-xs text-white/60 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {onlineCount}
            </span>
            {questions.length > 0 && (
              <span className="text-xs text-white/50">
                Q{Math.min(currentIndex + 1, questions.length)}/{questions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {timerLeft != null && isLive && (
              <span className={`text-xl font-bold tabular-nums ${timerLeft <= 5 ? 'text-red-400' : ''}`}>
                {timerLeft}s
              </span>
            )}
            <button onClick={() => setPresentMode(false)} className="btn-ghost text-white hover:bg-white/10 text-sm py-1">
              <X className="w-4 h-4" /> Exit
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 flex flex-col">
          {showLobby && (
            <div className="flex-1 min-h-0 flex flex-row items-center justify-center gap-8">
              <JoinCard />
              <div className="text-left max-w-md">
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Waiting for players</p>
                <h1 className="font-display text-3xl font-bold mb-2">Join this game</h1>
                <p className="text-white/60 text-sm">Scan the QR or visit the site and enter the room code</p>
              </div>
            </div>
          )}

          {betweenQuestions && !isLive && (
            <div className="flex-1 min-h-0 flex flex-row items-center justify-center gap-8">
              <JoinCard />
              <div className="text-left max-w-lg">
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">
                  Up next · Question {currentIndex + 1} of {questions.length}
                </p>
                <h1 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight">
                  Are you ready for the next puzzle?
                </h1>
                <p className="text-white/60 text-sm mb-6">
                  Press Start next or use the arrow below when your audience is ready
                </p>
                <button
                  type="button"
                  onClick={() => startQuestionByIndex(currentIndex)}
                  className="btn-accent px-8 py-3"
                >
                  <Play className="w-4 h-4" /> Start next question
                </button>
              </div>
            </div>
          )}

          {/* After last question — ready for results (manual) */}
          {readyForResults && !isLive && (
            <div className="flex-1 min-h-0 flex flex-row items-center justify-center gap-8 px-4">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="text-7xl md:text-8xl select-none" aria-hidden>
                  🏆
                </div>
                <div className="flex gap-3 text-4xl md:text-5xl select-none" aria-hidden>
                  <span>🎉</span>
                  <span>✨</span>
                  <span>🎊</span>
                </div>
                <div className="flex gap-2 text-3xl select-none mt-1" aria-hidden>
                  <span>🌟</span>
                  <span>💫</span>
                  <span>⭐</span>
                </div>
              </div>
              <div className="text-left max-w-lg">
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">All questions complete</p>
                <h1 className="font-display text-3xl md:text-5xl font-bold mb-3 leading-tight">
                  Are you ready for the results?
                </h1>
                <p className="text-white/60 text-sm mb-6">
                  Build the suspense — reveal the final scores when your audience is ready
                </p>
                <button type="button" onClick={goNext} className="btn-accent px-8 py-3">
                  <Play className="w-4 h-4" /> Reveal scores
                </button>
              </div>
            </div>
          )}

          {isLive && (
            <div className="flex-1 min-h-0 flex flex-col gap-2 max-w-6xl mx-auto w-full">
              <div className="flex items-start gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                    Question {currentIndex + 1} of {questions.length}
                  </p>
                  <h1 className="font-display text-xl md:text-3xl font-bold leading-snug line-clamp-3">
                    {(activeQuestion || currentQ)?.question_text}
                  </h1>
                </div>
                <JoinCard compact />
              </div>
              <div className="flex-1 min-h-0 bg-white text-slate-900 rounded-2xl p-4 md:p-6 shadow-2xl overflow-hidden flex flex-col">
                {liveChartResults ? (
                  <div className="flex-1 min-h-0">
                    <ResultsChart results={liveChartResults} presentMode />
                  </div>
                ) : (
                  <p className="text-center text-slate-400 m-auto text-base">No options for this question</p>
                )}
              </div>
            </div>
          )}

          {showFinalResults && !isLive && !betweenQuestions && !readyForResults && !answerReview && (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 max-w-xl mx-auto w-full overflow-hidden">
              <div className="text-center shrink-0">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Game complete</p>
                <h1 className="font-display text-3xl font-bold">Final scores</h1>
              </div>
              <div className="bg-white text-slate-900 rounded-2xl p-5 shadow-2xl w-full flex-1 min-h-0 overflow-y-auto">
                {leaderboard.length > 0 ? (
                  <Leaderboard entries={leaderboard} presentMode />
                ) : (
                  <p className="text-center text-slate-400 py-8">No scores yet</p>
                )}
              </div>
              {quizQuestions.length > 0 && (
                <button type="button" onClick={goNext} className="btn-accent px-6 py-3 shrink-0">
                  Reveal correct answers →
                </button>
              )}
            </div>
          )}

          {/* One-by-one correct answer reveal */}
          {answerReview && !isLive && (() => {
            const q = quizQuestions[reviewIndex];
            if (!q) return null;
            const correct = (q.options || []).find((o) => o.id === q.correct_option_id);
            const correctText = correct?.option_text || correct?.text || '—';
            const opts = q.options || [];
            return (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center max-w-3xl mx-auto w-full px-2">
                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">
                  Answer key · {reviewIndex + 1} of {quizQuestions.length}
                </p>
                <div className="w-full bg-gradient-to-br from-white to-slate-50 text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
                  <div className="bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-4 text-white">
                    <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Question</p>
                    <h2 className="font-display text-xl md:text-2xl font-bold leading-snug">
                      {q.question_text}
                    </h2>
                  </div>
                  <div className="p-6 md:p-8 space-y-3">
                    {opts.map((o, i) => {
                      const isCorrect = o.id === q.correct_option_id;
                      const label = o.option_text || o.text;
                      return (
                        <div
                          key={o.id || i}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border-2 transition-all duration-500 ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                              : 'border-slate-100 bg-slate-50 opacity-60'
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isCorrect ? '✓' : String.fromCharCode(65 + i)}
                          </span>
                          <span className={`flex-1 font-medium ${isCorrect ? 'text-emerald-900' : 'text-slate-600'}`}>
                            {label}
                          </span>
                          {isCorrect && (
                            <span className="text-xs font-bold uppercase tracking-wide text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                              Correct
                            </span>
                          )}
                        </div>
                      );
                    })}
                    <div className="mt-4 text-center">
                      <p className="text-sm text-slate-500">The correct answer is</p>
                      <p className="font-display text-2xl md:text-3xl font-bold text-emerald-600 mt-1 animate-fade-in">
                        {correctText}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-5">
                  {reviewIndex < quizQuestions.length - 1 ? (
                    <button type="button" onClick={goNext} className="btn-accent px-6 py-2.5">
                      Next answer →
                    </button>
                  ) : (
                    <p className="text-white/50 text-sm">All correct answers revealed</p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex justify-center items-center gap-2 py-2.5 bg-black/30 shrink-0 h-14">
          {!betweenQuestions && !readyForResults && (
            <button onClick={handleStart} className="btn-accent text-sm py-2" disabled={!currentQ || isLive || showFinalResults}>
              <Play className="w-4 h-4" /> Start
            </button>
          )}
          {betweenQuestions && (
            <button onClick={() => startQuestionByIndex(currentIndex)} className="btn-accent text-sm py-2">
              <Play className="w-4 h-4" /> Start next
            </button>
          )}
          {readyForResults && (
            <button onClick={goNext} className="btn-accent text-sm py-2">
              <Play className="w-4 h-4" /> Reveal scores
            </button>
          )}
          {showFinalResults && !answerReview && quizQuestions.length > 0 && (
            <button onClick={goNext} className="btn-accent text-sm py-2">
              Reveal answers
            </button>
          )}
          {answerReview && reviewIndex < quizQuestions.length - 1 && (
            <button onClick={goNext} className="btn-accent text-sm py-2">
              Next answer
            </button>
          )}
          <button onClick={handleStop} className="btn bg-white/15 text-white hover:bg-white/25 text-sm py-2" disabled={!isLive}>
            <Square className="w-4 h-4" /> Stop
          </button>
          <button
            onClick={goPrev}
            className="btn bg-white/15 text-white hover:bg-white/25 text-sm py-2 px-3"
            disabled={isLive || showFinalResults || (currentIndex <= 0 && !betweenQuestions && !readyForResults)}
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goNext}
            className="btn bg-white/15 text-white hover:bg-white/25 text-sm py-2 px-3"
            disabled={
              isLive ||
              (showFinalResults && quizQuestions.length === 0) ||
              (answerReview && reviewIndex >= quizQuestions.length - 1) ||
              (!betweenQuestions && !readyForResults && !showFinalResults && !answerReview && currentIndex >= questions.length - 1)
            }
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // —— NORMAL HOST DASHBOARD ——
  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-dvh">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display font-bold text-brand-700">Fun Game</Link>
            <Link to="/rooms" className="text-sm text-slate-500 hover:text-brand-600 hidden sm:inline">
              My rooms
            </Link>
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
            <Link to="/rooms" className="btn-secondary text-sm">
              My rooms
            </Link>
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

      <div className="max-w-7xl mx-auto w-full px-4 pt-6">
        <div className="card p-4 mb-4">
          <h2 className="font-display font-bold text-slate-800 mb-3 text-sm">Room settings</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-start gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={room?.revealAnswersAtEnd !== false}
                onChange={(e) => saveRoomSetting({ revealAnswersAtEnd: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600"
              />
              <span>
                <span className="text-sm font-medium text-slate-800 block">Reveal correct answers at the end</span>
                <span className="text-xs text-slate-500">After final scores, show correct answers one-by-one for all quiz questions</span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={!!room?.feedbackEnabled}
                onChange={(e) => saveRoomSetting({ feedbackEnabled: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600"
              />
              <span>
                <span className="text-sm font-medium text-slate-800 block">Collect feedback</span>
                <span className="text-xs text-slate-500">Turn on to add Feedback (1–5) questions like normal questions</span>
              </span>
            </label>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto w-full px-4 pb-6 grid lg:grid-cols-12 gap-6 flex-1">
        <aside className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-slate-800">Questions</h2>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2 px-3">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {showForm && (
            <QuestionForm onSubmit={handleCreateQuestion} onCancel={() => setShowForm(false)} loading={creatingQ} feedbackEnabled={!!room?.feedbackEnabled} />
          )}
          <div className="space-y-2">
            {questions.length === 0 && !showForm && (
              <p className="text-sm text-slate-400 text-center py-8">No questions yet. Add one to get started.</p>
            )}
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => { setCurrentIndex(i); setResults(null); setShowFinalResults(false); }}
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
                {timerLeft != null && isLive && (
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
                  disabled={isLive && activeQuestion?.id === currentQ.id}
                >
                  <Play className="w-4 h-4" /> Start
                </button>
                <button onClick={handleStop} className="btn-secondary" disabled={!isLive}>
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
                      {isLive && (
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
