/**
 * Quiz scoring algorithm.
 * Base score for correct answer + time bonus for faster responses.
 * Configurable via env vars.
 */
function calculateScore({ isCorrect, responseTimeMs, timerSeconds }) {
  if (!isCorrect) return 0;

  const base = parseInt(process.env.QUIZ_BASE_SCORE || '1000', 10);
  const maxBonus = parseInt(process.env.QUIZ_TIME_BONUS_MAX || '500', 10);

  if (!timerSeconds || timerSeconds <= 0 || responseTimeMs == null) {
    return base;
  }

  const maxMs = timerSeconds * 1000;
  const clamped = Math.max(0, Math.min(responseTimeMs, maxMs));
  // Faster = higher bonus. Linear decay.
  const ratio = 1 - clamped / maxMs;
  const bonus = Math.round(maxBonus * ratio);

  return base + bonus;
}

module.exports = { calculateScore };
