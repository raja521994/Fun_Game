import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

const BASE_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'rating', label: 'Rating (1–5)' },
  { value: 'word_cloud', label: 'Word Cloud' },
  { value: 'open_text', label: 'Open Text' },
];

const TIMERS = [0, 5, 10, 15, 30, 60];

export default function QuestionForm({
  onSubmit,
  onCancel,
  loading,
  feedbackEnabled = false,
  feedbackOnly = false,
}) {
  const TYPES = feedbackOnly
    ? [{ value: 'feedback', label: 'Feedback (1–5)' }]
    : BASE_TYPES;

  const [type, setType] = useState(feedbackOnly ? 'feedback' : 'multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const canBeQuiz = type === 'multiple_choice' || type === 'yes_no';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const quizOn = canBeQuiz && isQuiz;

    const payload = {
      type: feedbackOnly ? 'feedback' : type,
      questionText: questionText.trim(),
      isQuiz: feedbackOnly ? false : quizOn,
      correctOptionIndex: feedbackOnly ? null : quizOn ? correctIndex : null,
      timerSeconds: feedbackOnly ? 0 : quizOn || timerSeconds > 0 ? timerSeconds : 0,
    };

    if (type === 'multiple_choice') {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2) return;
      payload.options = clean;
      if (quizOn && (correctIndex < 0 || correctIndex >= clean.length)) {
        payload.correctOptionIndex = 0;
      }
    }

    if (type === 'yes_no' && quizOn) {
      payload.correctOptionIndex = correctIndex === 1 ? 1 : 0;
    }

    onSubmit(payload);
  };

  const addOption = () => {
    if (options.length < 8) setOptions([...options, '']);
  };

  const removeOption = (i) => {
    if (options.length <= 2) return;
    const next = options.filter((_, idx) => idx !== i);
    setOptions(next);
    if (correctIndex >= next.length) setCorrectIndex(0);
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-slate-800">
          {feedbackOnly ? 'New feedback question' : 'New Question'}
        </h3>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {!feedbackOnly && (
        <div>
          <label className="label">Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setType(t.value);
                  if (t.value !== 'multiple_choice' && t.value !== 'yes_no') setIsQuiz(false);
                  if (t.value === 'yes_no') setCorrectIndex(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  type === t.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {feedbackOnly && (
        <p className="text-xs text-slate-500 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
          Rating scale 1–5 · Shown to the audience after the thank-you message
        </p>
      )}

      <div>
        <label className="label">Question</label>
        <textarea
          className="input min-h-[80px] resize-y"
          placeholder={
            type === 'feedback'
              ? 'e.g. How would you rate this session overall?'
              : 'What do you want to ask?'
          }
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          maxLength={500}
          required
        />
      </div>

      {(type === 'rating' || type === 'feedback') && (
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600">
          Participants pick a score from <strong>1</strong> to <strong>5</strong>
          {type === 'feedback' ? ' for feedback (no right/wrong).' : '.'}
        </div>
      )}

      {type === 'multiple_choice' && (
        <div>
          <label className="label">Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                {isQuiz && (
                  <button
                    type="button"
                    title="Mark as correct answer"
                    onClick={() => setCorrectIndex(i)}
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      correctIndex === i
                        ? 'border-accent-500 bg-accent-500'
                        : 'border-slate-300 hover:border-accent-400'
                    }`}
                  >
                    {correctIndex === i && <span className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                )}
                <input
                  className="input flex-1"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="btn-ghost p-2 text-slate-400 hover:text-red-500"
                  disabled={options.length <= 2}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button type="button" onClick={addOption} className="btn-ghost text-sm mt-2 text-brand-600">
              <Plus className="w-4 h-4" /> Add option
            </button>
          )}
        </div>
      )}

      {type === 'yes_no' && (
        <div>
          <label className="label">Answers</label>
          <div className="space-y-2">
            {['Yes', 'No'].map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isQuiz && correctIndex === i
                    ? 'border-accent-500 bg-accent-500/5'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                {isQuiz ? (
                  <button
                    type="button"
                    title={`Mark "${label}" as correct`}
                    onClick={() => setCorrectIndex(i)}
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      correctIndex === i
                        ? 'border-accent-500 bg-accent-500'
                        : 'border-slate-300 hover:border-accent-400'
                    }`}
                  >
                    {correctIndex === i && <span className="w-2 h-2 rounded-full bg-white" />}
                  </button>
                ) : (
                  <span
                    className="w-1.5 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: i === 0 ? '#22c55e' : '#ef4444' }}
                  />
                )}
                <span className="font-medium text-slate-800">{label}</span>
                {isQuiz && correctIndex === i && (
                  <span className="ml-auto text-xs font-semibold text-accent-600">Correct</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canBeQuiz && (
        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 p-4 bg-slate-50/80">
          <input
            type="checkbox"
            checked={isQuiz}
            onChange={(e) => setIsQuiz(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="text-sm font-medium text-slate-800 block">Quiz mode</span>
            <span className="text-xs text-slate-500">Score correct answers on the leaderboard</span>
          </span>
        </label>
      )}

      <div>
        <label className="label">Timer (seconds)</label>
        <div className="flex flex-wrap gap-2">
          {TIMERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimerSeconds(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                timerSeconds === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 0 ? 'None' : `${t}s`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn-primary flex-1" disabled={loading}>
          {loading ? 'Saving…' : 'Add question'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

