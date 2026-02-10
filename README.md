# Study Planner - React Flow (WebStorm-ready)

This project uses Vite + React + React Flow to build a semester-based study planner.

## Run in WebStorm (frontend)

1. Open this project folder in WebStorm.
2. Open the built-in terminal and run these commands in `frontend`:

```bash
npm install
npm run dev
```

3. Open the URL printed in the terminal (usually `http://localhost:5173`).

## Run backend (Docker)

Run these commands in the `backend` folder:

```bash
docker compose up -d --build
```

## Reset backend containers and data, then restart

Run in the `backend` folder:

```bash
docker compose down -v --remove-orphans
docker compose up -d --build
```

This removes backend containers, networks, and volumes (database data), then starts fresh containers again.

## What it does

- Semester lanes are React Flow nodes, so they pan and zoom with the viewport.
- Drag a course from the sidebar into any lane; it snaps into the nearest lane.
- Supports pan/zoom, minimap, grid, and free-form course edges.

## Customize

- Edit `SEMESTERS` in `src/App.jsx` to add or remove semesters.
- Replace `COURSE_CATALOG` with your real course list.
