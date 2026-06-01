# Niki — Task Manager

A self-hosted task management platform built specifically for AuDHD (Autism + ADHD) brains. Shifts focus from *information tracking* to *execution support*.

**Live at:** [pm.janhellion.com](https://pm.janhellion.com)

---

## Why This Exists

Standard task tools (GTD, Kanban, Pomodoro, habit trackers) assume a neurotypical executive function model. They put you in the *manager* role — plan, prioritise, schedule, review. For AuDHD brains, the manager role is exactly what's impaired.

This platform addresses the real bottlenecks:
- **Task invisibility** — out of sight = out of existence. Tasks must have visual weight.
- **Initiation paralysis** — knowing what to do ≠ being able to start. Micro-steps and frictionless capture lower the barrier.
- **Demand avoidance** — "should" and "must" trigger resistance. Phrasing is neutral, autonomy-first.
- **Energy ≠ time** — time-blocking assumes predictable capacity. Energy-based scheduling adapts to how you actually feel.
- **Burnout** — performance degradation is detected, not ignored. The UI simplifies itself.

---

## Core Features

### Banana (The One Thing)
A single daily focus slot. Lock one task per day. Everything else waits until it's done.

### Micro-Step Splitter
Every task can have a single 2-minute opening action. The first step is always the hardest — make it trivially small.

### Energy Pills
Track your state: Low / Medium / High. Tasks are tagged by energy level, not time blocks. The system suggests matches over time.

### Quick Capture
Press `n` anywhere. Type a thought. No folders, no tags, no categorisation at capture time. Structure is applied later.

### Burnout Safe-Mode
When the deferral rate exceeds 50%, a banner appears. Enter safe mode: sidebar disappears, font scales up, non-essential UI hides.

### Stability Slider
Per-project control from 0% (surprise / novelty / randomness) to 100% (rigid structure, fixed routines).

### Zero Shaming Design
No streak counters. No "overdue" flags. No guilt. Tasks that aren't ready can be deferred with a neutral "Not Now" button.

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  Browser     │─────▶│  Caddy       │─────▶│  FastAPI      │
│  (SPA + PWA) │◀────│  (reverse    │◀────│  (port 8000)  │
│              │     │   proxy)     │      │              │
└─────────────┘      └──────────────┘      └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │  SQLite       │
                                           │  (local file) │
                                           └──────────────┘
```

### Stack
- **Backend:** Python + FastAPI
- **Database:** SQLite (single file, local-first)
- **Frontend:** Vanilla JS SPA (no framework dependency)
- **Design:** 1:8 proportion system, light scheme, orange (#eb5e28) accent, 8px uniform radius
- **Reverse proxy:** Caddy (auto HTTPS, Cloudflare tunnel compatible)
- **Deployment:** Single Docker container

### API
All UI actions map to REST endpoints. Full OpenAPI docs at `/docs`.

Key endpoints:
- `GET /api/dashboard` — aggregated view (banana, tasks, deferral rate, energy state)
- `GET/POST /api/tasks` — list and create
- `PUT /api/tasks/{id}` — update fields
- `POST /api/tasks/{id}/complete` — complete
- `POST /api/tasks/{id}/defer` — defer with reason
- `GET/POST/PUT /api/projects` — project CRUD
- `POST /api/energy-log` — log energy state

---

## Quick Start

### Docker (recommended)
```bash
git clone <repo-url>
cd audhd-pm
docker compose up -d
# Open http://localhost:8000
```

### Local development
```bash
pip install -r backend/requirements.txt uvicorn
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
# Open http://localhost:8000
```

### Directory structure
```
audhd-pm/
├── backend/
│   ├── main.py          # FastAPI app, static file mount
│   ├── database.py      # SQLAlchemy engine, session
│   ├── models.py        # ORM models (Task, Project, EnergyLog, etc.)
│   ├── schemas.py       # Pydantic schemas + task_to_response helper
│   └── routers/
│       ├── dashboard.py # Aggregated dashboard endpoint
│       ├── tasks.py     # Full task CRUD + complete/defer/reactivate
│       ├── projects.py  # Project CRUD
│       └── settings.py  # Key/value settings + energy logging
├── frontend/
│   ├── index.html       # Main SPA shell
│   ├── manifest.json    # PWA manifest
│   ├── css/style.css    # Full design system (light scheme, 1:8, glass)
│   └── js/app.js        # All UI logic (views, modals, API calls)
├── data/                # SQLite database (gitignored)
├── Dockerfile
├── docker-compose.yml
└── .gitignore
```

---

## Design System

See [BRANDING.md](./BRANDING.md) for the full spec.

Key principles:
- **1:8 proportion** — all spacing is multiples of 8px
- **8px radius** — every corner, everywhere
- **Orange accent** — `#eb5e28` is the single attention colour
- **Light scheme** — warm off-white background, white surfaces, dark text
- **Zero shaming** — no guilt mechanics anywhere in the UI or database

---

## License

MIT — do what you want with it. Built for and by neurodivergent people.
