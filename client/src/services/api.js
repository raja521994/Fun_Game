const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return data;
}

export const api = {
  createRoom: (title) =>
    request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  getRoomByCode: (code) => request(`/rooms/code/${encodeURIComponent(code)}`),

  getHostRoom: (token) =>
    request(`/rooms/host/${encodeURIComponent(token)}`, {
      headers: { 'X-Host-Token': token },
    }),

  endRoom: (token) =>
    request('/rooms/end', {
      method: 'POST',
      headers: { 'X-Host-Token': token },
      body: JSON.stringify({ hostToken: token }),
    }),

  createQuestion: (token, data) =>
    request('/questions', {
      method: 'POST',
      headers: { 'X-Host-Token': token },
      body: JSON.stringify({ ...data, hostToken: token }),
    }),

  listQuestions: (token) =>
    request('/questions', {
      headers: { 'X-Host-Token': token },
    }),

  startQuestion: (token, questionId) =>
    request(`/questions/${questionId}/start`, {
      method: 'POST',
      headers: { 'X-Host-Token': token },
      body: JSON.stringify({ hostToken: token }),
    }),

  stopQuestion: (token, questionId) =>
    request(`/questions/${questionId}/stop`, {
      method: 'POST',
      headers: { 'X-Host-Token': token },
      body: JSON.stringify({ hostToken: token }),
    }),

  getResults: (questionId, token) =>
    request(`/questions/${questionId}/results`, {
      headers: token ? { 'X-Host-Token': token } : {},
    }),

  getLeaderboard: (token) =>
    request('/leaderboard', {
      headers: { 'X-Host-Token': token },
    }),

  deleteQuestion: (token, questionId) =>
    request(`/questions/${questionId}`, {
      method: 'DELETE',
      headers: { 'X-Host-Token': token },
    }),

  exportCsvUrl: (token) => `${API_BASE}/rooms/export?hostToken=${encodeURIComponent(token)}`,
};

export default api;
