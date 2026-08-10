# Fun Game

**Interactive audience engagement platform** for live polls, quizzes, word clouds, ratings, and more.

Hosts create a session and share a short room code. Participants join from any phone or browser — no registration required.

Inspired by tools like Mentimeter, built as an original open-source application.

---

## Features

- **Live polls** — Multiple choice with real-time bar charts  
- **Word clouds** — Aggregate free-text responses visually  
- **Rating questions** — 1–5 scale with average and distribution  
- **Yes / No** — Quick binary questions with pie charts  
- **Open text** — Collect short written responses  
- **Quiz mode** — Correct answers, timed questions, scoring & leaderboard  
- **Present mode** — Full-screen view for projectors  
- **CSV export** — Download all results  
- **No accounts** — Host gets a private control link; participants only need a room code  
- **Mobile-first** participant UI  
- **Reconnection** support for host and participants  

---

## Architecture

```
fun-game/
├── client/          # React + Vite + Tailwind CSS
├── server/          # Node.js + Express + Socket.IO + SQLite
├── render.yaml      # Render.com blueprint
└── package.json     # Root scripts
```

- **Real-time:** Socket.IO (WebSocket + polling fallback)
- **Database:** SQLite via `better-sqlite3` (file-based; structured for future PostgreSQL)
- **Production:** Express serves the Vite build and the API on one port

---

## Requirements

- Node.js **18+** (20 recommended)
- npm 9+

---

## Local installation

```bash
# Clone
git clone <your-repo-url> fun-game
cd fun-game

# Install all dependencies
npm run install:all

# Or manually:
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

Copy environment file:

```bash
cp .env.example server/.env
# Edit server/.env if needed
```

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `DATABASE_URL` | SQLite file path | `./data/fungame.db` |
| `CLIENT_URL` | Frontend origin (CORS in dev) | `http://localhost:5173` |
| `SESSION_SECRET` | Secret for tokens | (change in prod) |
| `QUIZ_BASE_SCORE` | Base points for correct answer | `1000` |
| `QUIZ_TIME_BONUS_MAX` | Max time bonus | `500` |

Never commit `.env` files.

---

## Running locally

### Development (two processes)

```bash
# Terminal 1 — backend
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev
```

Or from root (requires `concurrently`):

```bash
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173  
- Backend / API: http://localhost:3000  
- Vite proxies `/api` and `/socket.io` to the backend  

### Production-style local run

```bash
cd client && npm run build && cd ..
cd server
NODE_ENV=production npm start
```

Open http://localhost:3000

---

## How to use

1. Open the app → **Create Game**  
2. Copy the **room code** (e.g. `ABC123`) and share it  
3. On the host dashboard, **Add** questions  
4. Click **Start** — participants see the question instantly  
5. Watch live results, use **Present** mode on a big screen  
6. **Export CSV** when finished  

Participants: open the site → **Join Game** → enter code + display name.

---

## GitHub setup

```bash
cd fun-game
git init
git add .
git commit -m "Initial commit: Fun Game interactive platform"
git branch -M main
git remote add origin https://github.com/YOUR_USER/fun-game.git
git push -u origin main
```

CI runs on push/PR via `.github/workflows/ci.yml` (install, test, build).

---

## Render deployment

The project is configured for a **single Web Service** on Render so frontend, API, and Socket.IO share one origin (simplest WebSocket support).

### Option A — Blueprint

1. Push the repo to GitHub  
2. In Render: **New** → **Blueprint** → connect the repo  
3. `render.yaml` will create the service  
4. Set `CLIENT_URL` to your Render URL if needed (often same origin is fine)  
5. Deploy  

### Option B — Manual Web Service

1. **New Web Service** → connect repo  
2. **Build command:**
   ```bash
   npm install && cd client && npm install && npm run build && cd ../server && npm install
   ```
3. **Start command:**
   ```bash
   cd server && NODE_ENV=production node src/server.js
   ```
4. Add env vars from the table above (`NODE_ENV=production`, `SESSION_SECRET` random, etc.)  
5. Optional: attach a persistent disk mounted at `server/data` so the SQLite file survives deploys  

Health check: `GET /api/health`

> **Note:** Free Render instances spin down after inactivity. The first request after sleep may take ~30s. For always-on, use a paid plan or keep-alive ping.

---

## API overview (REST)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/rooms` | Create room |
| GET | `/api/rooms/code/:code` | Lookup room |
| GET | `/api/rooms/host/:token` | Host session state |
| POST | `/api/rooms/end` | End game |
| GET | `/api/rooms/export` | CSV export |
| POST | `/api/questions` | Create question (host) |
| POST | `/api/questions/:id/start` | Start question |
| POST | `/api/questions/:id/stop` | Stop question |
| GET | `/api/questions/:id/results` | Results |
| GET | `/api/health` | Health check |

Host endpoints require header `X-Host-Token`.

### Socket.IO events (main)

**Client → Server:** `host_join`, `join_room`, `start_question`, `stop_question`, `show_results`, `submit_answer`, `end_game`, `timer_expired`, `sync_state`

**Server → Client:** `participant_joined`, `participant_left`, `question_started`, `question_stopped`, `answer_received`, `results_updated`, `game_ended`

---

## Testing

```bash
cd server
npm test
```

Covers room creation, join, invalid room, questions, answers, duplicate prevention, and scoring.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors in dev | Ensure `CLIENT_URL` matches Vite origin; proxy is configured in `vite.config.js` |
| Socket not connecting | Check that backend is running; in production use same origin |
| `better-sqlite3` build fails | Install build tools (`python3`, `make`, `g++`); use Node 18/20 |
| Room not found | Codes are case-insensitive; avoid ambiguous characters (O/0, I/1) |
| Host loses control after refresh | Use the same host URL (`/host/:token`); token is in the path |
| DB wiped on Render | Attach a persistent disk to `server/data` |

---

## Tech stack

- **Frontend:** React 18, Vite 5, Tailwind CSS 3, Recharts, Lucide icons, Socket.IO client  
- **Backend:** Express 4, Socket.IO 4, better-sqlite3, Zod, Helmet, express-rate-limit  
- **Tooling:** Node test runner, GitHub Actions  

---

## License

MIT — use freely for learning, internal tools, or commercial projects.
