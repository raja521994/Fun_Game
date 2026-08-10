import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

const TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'rating', label: 'Rating (1–5)' },
  { value: 'word_cloud', label: 'Word Cloud' },
  { value: 'open_text', label: 'Open Text' },
];

const TIMERS = [0, 5, 10, 15, 30, 60];

export default function QuestionForm({ onSubmit, onCancel, loading }) {
  const [type, setType] = useState('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const payload = {
      type,
      questionText: questionText.trim(),
      isQuiz: type === 'multiple_choice' ? isQuiz : false,
      correctOptionIndex: type === 'multiple_choice' && isQuiz ? correctIndex : null,
      timerSeconds: isQuiz || timerSeconds > 0 ? timerSeconds : 0,
    };

    if (type === 'multiple_choice') {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2) return;
      payload.options = clean;
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
        <h3 className="font-display font-bold text-lg text-slate-800">New Question</h3>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div>
        <label className="label">Type</label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value);
                if (t.value !== 'multiple_choice') setIsQuiz(false);
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

      <div>
        <label className="label" htmlFor="qtext">
          Question
        </label>
        <textarea
          id="qtext"
          className="input min-h-[80px] resize-y"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value.slice(0, 500))}
          placeholder="Enter your question…"
          required
        />
      </div>

      {type === 'multiple_choice' && (
        <div>
          <label className="label">Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                {isQuiz && (
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    title="Mark as correct"
                    className="accent-brand-600"
                  />
                )}
                <input
                  className="input flex-1"
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value.slice(0, 200);
                    setOptions(next);
                  }}
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="btn-ghost text-red-500 p-2"
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

          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={isQuiz}
              onChange={(e) => setIsQuiz(e.target.checked)}
              className="accent-brand-600 rounded"
            />
            <span className="text-sm font-medium text-slate-700">Quiz mode (track scores)</span>
          </label>
        </div>
      )}

      {(isQuiz || type === 'multiple_choice') && (
        <div>
          <label className="label">Timer (optional)</label>
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
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Adding…' : 'Add Question'}
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
