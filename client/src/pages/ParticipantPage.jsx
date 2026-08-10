import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Clock, WifiOff } from 'lucide-react';
import { connectSocket, emitWithAck, getSocket } from '../services/socket';

export default function ParticipantPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const roomCode = (code || '').toUpperCase();
  const name = sessionStorage.getItem(`playerName:${roomCode}`) || '';

  const [status, setStatus] = useState('connecting'); // connecting | waiting | active | answered | results | ended | error
  const [error, setError] = useState('');
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [timerLeft, setTimerLeft] = useState(null);
  const [scoreInfo, setScoreInfo] = useState(null);
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
      setResults(null);
      setScoreInfo(null);
      setStatus('active');
      startedAtRef.current = startedAt || Date.now();
      if (q.timer_seconds > 0) {
        setTimerLeft(q.timer_seconds);
      } else {
        setTimerLeft(null);
      }
    };

    const onQuestionStopped = ({ results: r }) => {
      setStatus('results');
      setResults(r);
      setTimerLeft(null);
    };

    const onResults = ({ results: r }) => {
      setResults(r);
      setStatus('results');
    };

    const onGameEnded = () => {
      setStatus('ended');
      setQuestion(null);
      setTimerLeft(null);
    };

    const onDisconnect = () => {
      // keep UI, try reconnect
    };

    socket.on('question_started', onQuestionStarted);
    socket.on('question_stopped', onQuestionStopped);
    socket.on('results_updated', onResults);
    socket.on('game_ended', onGameEnded);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('question_started', onQuestionStarted);
      socket.off('question_stopped', onQuestionStopped);
      socket.off('results_updated', onResults);
      socket.off('game_ended', onGameEnded);
      socket.off('disconnect', onDisconnect);
    };
  }, [join]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'active' || !question?.timer_seconds || !startedAtRef.current) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const left = Math.max(0, Math.ceil(question.timer_seconds - elapsed));
      setTimerLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
      }
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [status, question]);

  const handleSubmit = async () => {
    if (!question || submitting) return;
    setSubmitting(true);
    try {
      const responseTimeMs = startedAtRef.current ? Date.now() - startedAtRef.current : null;
      const payload = {
        questionId: question.id,
        responseTimeMs,
      };
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
        <Link to={`/join/${roomCode}`} className="btn-primary">
          Try again
        </Link>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center bg-slate-50">
        <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">Game ended</h2>
        <p className="text-slate-500 mb-6">Thanks for playing!</p>
        <Link to="/" className="btn-primary">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-brand-50 to-white min-h-dvh">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div>
          <p className="font-display font-bold text-brand-700 text-sm">FUN GAME</p>
          <p className="text-xs text-slate-500">
            Room: <span className="font-mono font-semibold tracking-wider">{roomCode}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{name}</p>
          {timerLeft != null && status === 'active' && (
            <p className={`text-xs font-bold flex items-center gap-1 justify-end ${timerLeft <= 5 ? 'text-red-500' : 'text-brand-600'}`}>
              <Clock className="w-3.5 h-3.5" />
              {timerLeft}s
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
        {status === 'connecting' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-500 animate-pulse-soft">Connecting…</p>
          </div>
        )}

        {status === 'waiting' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-brand-500 animate-pulse-soft" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-800 mb-2">Waiting for host…</h2>
            <p className="text-slate-500 text-sm">The next question will appear here automatically.</p>
          </div>
        )}

        {status === 'active' && question && (
          <div className="animate-slide-up space-y-6">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {question.question_text}
            </h2>

            {(question.type === 'multiple_choice' || question.type === 'yes_no' || question.type === 'rating') && (
              <div className="space-y-3">
                {(question.options || []).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelected(opt.id)}
                    className={`w-full text-left px-5 py-4 rounded-2xl border-2 font-medium transition-all ${
                      selected === opt.id
                        ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-soft'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
                    }`}
                  >
                    {opt.option_text}
                  </button>
                ))}
              </div>
            )}

            {(question.type === 'word_cloud' || question.type === 'open_text') && (
              <div>
                <input
                  className="input text-lg"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value.slice(0, 200))}
                  placeholder={question.type === 'word_cloud' ? 'Type a word or short phrase…' : 'Your answer…'}
                  maxLength={200}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                ((question.type === 'word_cloud' || question.type === 'open_text')
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
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in">
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

        {status === 'results' && (
          <div className="animate-fade-in text-center space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-800">Results</h2>
            {results?.options && (
              <div className="space-y-2 text-left">
                {results.options.map((o) => (
                  <div key={o.optionId || o.text} className="bg-white rounded-xl border border-slate-100 p-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{o.text}</span>
                      <span className="text-slate-500">{o.percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${o.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {results?.average != null && (
              <p className="text-3xl font-display font-bold text-brand-600">{results.average}</p>
            )}
            <p className="text-sm text-slate-400">Waiting for next question…</p>
          </div>
        )}

        {error && status !== 'error' && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}
      </main>
    </div>
  );
}
