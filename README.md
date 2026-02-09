# Study Planner — React Flow (WebStorm-ready)

This is a minimal Vite + React project that uses **React Flow** to build a semester-based study planner.

## Run in WebStorm \frontend

1. **File → Open...** and select this folder.
2. Open the built-in terminal (bottom toolbar) and run (in folder frontend):
   ```bash
   npm install
   npm run dev
   ```

## Run in WebStorm \backend
   ```bash
   docker compose up -d --build
   ```



3. Click the URL printed in the terminal (usually http://localhost:5173).

## What it does

- **Semester lanes** are React Flow nodes, so they pan & zoom with the viewport.
- Drag a course from the **sidebar** into any lane — it snaps inside the nearest lane.
- Pan/zoom, minimap, grid, and free-form edges between courses.

## Customize

- Edit `SEMESTERS` in `src/App.jsx` to add/remove semesters.
- Replace `COURSE_CATALOG` with your real course list.


## Delte Database Data

**run in backend**

```bash
docker compose down -v
docker compose up -d
```