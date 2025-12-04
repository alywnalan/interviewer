# Interviewer (Simple Node + Static Frontend)
#
# Repository topics: nodejs, express, static-frontend, interview, template, javascript
# GitHub Description: Example Node.js backend and static frontend for interview/test purposes. Includes basic server, static HTML, and CI workflow.

Description
- Small example project containing a Node.js backend and a static frontend used for interview/test purposes.

Repository structure
- `backend/` — Node.js app (contains `package.json`, `server.js`).
- `frontend/` — static frontend (contains `index.html`).

Quick start (local)
1. Install dependencies for the backend:
   - Open a terminal in `backend` and run `npm install`.
2. Start backend server:
   - `cd backend` then `node server.js` (or `npm start` if script defined).
3. Serve the frontend:
   - Open `frontend/index.html` in a browser, or serve it with a static server.

Notes for repository maintainers
- A `.gitignore` was added to exclude `node_modules/` and common local files.
- The initial local commit removed tracked `node_modules` to keep the repo small.

How to run (development)

- Backend (example):
  - Install Node.js (v14+ recommended).
  - `cd backend`
  - `npm install`
  - `node server.js` (the server listens on the port specified in `server.js` or environment variable)

- Frontend:
  - Open `frontend/index.html` in a browser, or run a local static server like `npx serve frontend`.

Contributing
- Create a feature branch, add tests, and open a PR. Keep `node_modules` out of commits.

Contact
- Repo owner: `alywnalan` on GitHub.
