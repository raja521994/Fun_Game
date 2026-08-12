import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Clock, WifiOff, Trophy } from 'lucide-react';
import { connectSocket, emitWithAck, getSocket } from '../services/socket';

export default function ParticipantPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const roomCode = (code || '').toUpperCase();
  const name = sessionStorage.getItem(`playerName:${roomCode}`) || '';

  // connecting | waiting | active | answered | between | ready_results | final_scores | ended | error
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timerLeft, setTimerLeft] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);

  const join = useCallback(async () => {
    if (!name) {
      navigate(`/join/${roomCode}`);
      return;
    }
    try {
      connectSocket();
      const res = await emitWithAck('join_room', { roomCode, name });
      setStatus(res.activeQuestion ? 'active' : 'waiting');
      if (res.activeQuestion) {
        setQuestion(res.activeQuestion);
        if (res.activeQuestion.alreadyAnswered) {
          setStatus('answered');
        }
        if (res.activeQuestion.timer_seconds > 0) {
          startedAtRef.current = Date.now();
        }
      }
    } catch (err) {
      setError(err.message || 'Could not join');
      setStatus('error');
    }
  }, [roomCode, name, navigate]);

  useEffect(() => {
    join();
    const socket = getSocket();

    const onQuestionStarted = ({ question: q, startedAt }) => {
      setQuestion(q);
      setSelected(null);
      setTextAnswer('');
      setScoreInfo(null);
      setStatus('active');
      startedAtRef.current = startedAt || Date.now();
      if (q.timer_seconds > 0) {
        setTimerLeft(q.timer_seconds);
      } else {
        setTimerLeft(null);
      }
    };

    // Don't dump participants into per-question results — wait for host phase
    const onQuestionStopped = () => {
      setTimerLeft(null);
      setStatus((s) => (s === 'active' || s === 'answered' ? 'waiting' : s));
    };

    const onPresentPhase = ({ phase, leaderboard: lb }) => {
      if (lb) setLeaderboard(lb);
      if (phase === 'between') {
        setStatus('between');
        setTimerLeft(null);
      } else if (phase === 'ready_results') {
        setStatus('ready_results');
        setTimerLeft(null);
      } else if (phase === 'final_scores') {
        setStatus('final_scores');
        setTimerLeft(null);
      } else if (phase === 'live') {
        // question_started will usually follow
      } else if (phase === 'waiting') {
        setStatus('waiting');
      }
    };

    const onGameEnded = () => {
      setStatus('ended');
      setTimerLeft(null);
    };

    const onDisconnect = () => {
      setError('Disconnected — reconnecting…');
    };

    socket.on('question_started', onQuestionStarted);
    socket.on('question_stopped', onQuestionStopped);
    socket.on('present_phase', onPresentPhase);
    socket.on('game_ended', onGameEnded);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('question_started', onQuestionStarted);
      socket.off('question_stopped', onQuestionStopped);
      socket.off('present_phase', onPresentPhase);
      socket.off('game_ended', onGameEnded);
      socket.off('disconnect', onDisconnect);
    };
  }, [join]);

  useEffect(() => {
    if (status !== 'active' || !question?.timer_seconds || !startedAtRef.current) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const left = Math.max(0, Math.ceil(question.timer_seconds - elapsed));
      setTimerLeft(left);
      if (left <= 0) clearInterval(timerRef.current);
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [status, question]);

  const handleSubmit = async () => {
    if (!question || submitting) return;
    setSubmitting(true);
    try {
      const responseTimeMs = startedAtRef.current ? Date.now() - startedAtRef.current : null;
      const payload = { questionId: question.id, responseTimeMs };
      if (question.type === 'word_cloud' || question.type === 'open_text') {
        if (!textAnswer.trim()) {
          setSubmitting(false);
          return;
        }
        payload.answerText = textAnswer.trim();
      } else {
        if (!selected) {
          setSubmitting(false);
          return;
        }
        payload.optionId = selected;
      }

      const res = await emitWithAck('submit_answer', payload);
      setStatus('answered');
      if (res.score != null) setScoreInfo({ score: res.score, isCorrect: res.isCorrect });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <WifiOff className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <Link to={`/join/${roomCode}`} className="btn-primary">Try again</Link>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center bg-slate-50">
        <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">Game ended</h2>
        <p className="text-slate-500 mb-6">Thanks for playing!</p>
        <Link to="/" className="btn-primary">Back to home</Link>
      </div>
    );
  }

  // Same teaser as host: ready for results
  if (status === 'ready_results') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-slate-900 text-white min-h-dvh">
        <div className="text-6xl mb-4 select-none" aria-hidden>🏆</div>
        <div className="flex gap-3 text-3xl mb-6 select-none" aria-hidden>
          <span>🎉</span><span>✨</span><span>🎊</span>
        </div>
        <p className="text-white/50 text-xs uppercase tracking-widest mb-2">All questions complete</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-3">
          Are you ready for the results?
        </h1>
        <p className="text-white/60 text-sm max-w-sm">
          Hang tight — the host will reveal the final scores soon
        </p>
      </div>
    );
  }

  // Final scores for everyone
  if (status === 'final_scores') {
    const medals = ['🥇', '🥈', '🥉'];
    return (
      <div className="flex-1 flex flex-col bg-slate-900 text-white min-h-dvh px-4 py-8">
        <div className="text-center mb-6">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Game complete</p>
          <h1 className="font-display text-2xl font-bold">Final scores</h1>
        </div>
        <div className="bg-white text-slate-900 rounded-2xl p-4 max-w-md mx-auto w-full shadow-xl">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-display font-bold text-lg">Leaderboard</h3>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No scores yet</p>
          ) : (
            <ul className="space-y-2">
              {leaderboard.slice(0, 15).map((e) => (
                <li
                  key={e.participantId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    e.name === name ? 'bg-brand-50 ring-2 ring-brand-400' : e.rank <= 3 ? 'bg-amber-50' : 'bg-slate-50'
                  }`}
                >
                  <span className="w-7 text-center font-bold text-sm">
                    {e.rank <= 3 ? medals[e.rank - 1] : e.rank}
                  </span>
                  <span className="flex-1 font-medium truncate text-sm">{e.name}</span>
                  <span className="font-display font-bold text-brand-600">{e.score}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-center text-white/40 text-xs mt-6">Thanks for playing, {name}!</p>
      </div>
    );
  }

  // Between questions
  if (status === 'between') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-slate-900 text-white min-h-dvh">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Get ready</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-3">
          Are you ready for the next puzzle?
        </h1>
        <p className="text-white/60 text-sm">Waiting for the host to start the next question…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-brand-50 to-white min-h-dvh">
      <header className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div>
          <p className="text-xs text-slate-400">Playing as</p>
          <p className="font-semibold text-slate-800">{name}</p>
        </div>
        <div className="font-mono text-sm font-bold tracking-widest text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg">
          {roomCode}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
        {(status === 'connecting' || status === 'waiting') && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin mb-4" />
            <h2 className="font-display text-xl font-bold text-slate-800 mb-1">
              {status === 'connecting' ? 'Connecting…' : 'Waiting for host'}
            </h2>
            <p className="text-slate-500 text-sm">The next question will appear here</p>
          </div>
        )}

        {(status === 'active' || status === 'answered') && question && (
          <div className="animate-fade-in">
            {timerLeft != null && status === 'active' && (
              <div className={`flex items-center justify-center gap-2 mb-4 font-bold tabular-nums ${
                timerLeft <= 5 ? 'text-red-500' : 'text-brand-600'
              }`}>
                <Clock className="w-5 h-5" />
                {timerLeft}s
              </div>
            )}

            <h2 className="font-display text-xl font-bold text-slate-900 mb-6 text-center leading-snug">
              {question.question_text}
            </h2>

            {status === 'active' && (
              <div className="space-y-4">
                {(question.type === 'word_cloud' || question.type === 'open_text') ? (
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Type your answer…"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    maxLength={200}
                  />
                ) : (
                  <div className="space-y-2">
                    {(question.options || []).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSelected(o.id)}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border-2 font-medium transition ${
                          selected === o.id
                            ? 'border-brand-500 bg-brand-50 text-brand-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {o.option_text}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    (question.type === 'word_cloud' || question.type === 'open_text'
                      ? !textAnswer.trim()
                      : !selected)
                  }
                  className="btn-primary w-full py-4 text-base"
                >
                  {submitting ? 'Submitting…' : 'Submit Answer'}
                </button>
              </div>
            )}

            {status === 'answered' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 animate-fade-in">
                <CheckCircle2 className="w-16 h-16 text-accent-500 mb-4" />
                <h2 className="font-display text-xl font-bold text-slate-800 mb-1">Answer submitted!</h2>
                {scoreInfo && scoreInfo.isCorrect != null && (
                  <p className={`text-sm font-medium mb-2 ${scoreInfo.isCorrect ? 'text-accent-600' : 'text-slate-500'}`}>
                    {scoreInfo.isCorrect ? `Correct! +${scoreInfo.score} pts` : 'Not quite — better luck next time'}
                  </p>
                )}
                <p className="text-slate-500 text-sm">Waiting for the host…</p>
              </div>
            )}
          </div>
        )}

        {error && status !== 'error' && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}
      </main>
    </div>
  );
}
