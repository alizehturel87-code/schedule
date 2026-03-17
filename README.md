# Daily Planner Hub

Daily Planner Hub is a Google Sheets backed planner with:

- a refreshed React and Vite frontend
- priority, broad head, and calendar views
- browser reminders for due tasks
- Netlify Functions as the bridge to Google Sheets
- Google Sheets as the source of truth for tasks, broad heads, and history

## Project structure

- `index.html`: Vite entry HTML
- `main.jsx`: React entry point
- `App.jsx`: top-level app shell
- `src/components/`: planner UI components
- `src/hooks/usePlannerApi.js`: frontend state and Netlify API integration
- `src/constants.js`: category metadata and app constants
- `src/helpers.js`: formatting and normalization helpers
- `src/index.css`: app styling
- `netlify/functions/tasks.js`: Netlify Function for Google Sheets reads and writes
- `netlify.toml`: Netlify build and functions config

## Views

- `Priority`: grouped by your existing task priority categories
- `Broad Heads`: grouped by broad head while keeping the same backend structure
- `Calendar`: monthly calendar with daily task agenda

## Google Sheets structure

The Netlify Function creates and maintains these tabs:

- `Tasks`
- `Broad Heads`
- `History`

## Environment variables

Set these in Netlify:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

## Local development

Install dependencies and run the app with Netlify so the frontend can reach the serverless function:

```powershell
npm install
npm run dev:netlify
```

## Build

```powershell
npm run build
```
