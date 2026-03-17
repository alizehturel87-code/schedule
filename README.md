# Daily Planner Hub

Daily Planner Hub is a React and Vite planner that keeps the existing Netlify and Google Sheets backend flow, but now follows the category, priority, and calendar structure from the reference planner app.

## App structure

- `App.jsx`: main planner shell
- `plannerApi.js`: frontend API bridge to Netlify Functions
- `plannerConstants.js`: priority and category defaults
- `plannerModel.js`: task, date, and category mapping helpers
- `PriorityView.jsx`: priority-grouped task view
- `CategoryView.jsx`: category-based task view
- `CalendarView.jsx`: calendar view
- `TaskForm.jsx`: add and edit task sheet
- `CategoryForm.jsx`: add category sheet
- `BottomNav.jsx`: bottom navigation
- `app.css`: planner styles and typography

## Backend

- `netlify/functions/tasks.js` still handles Google Sheets reads and writes
- the Sheets tabs remain:
  - `Tasks`
  - `Broad Heads`
  - `History`

The frontend now uses the `Broad Heads` sheet as the category store so the backend database structure stays the same.

## Resetting old data

The backend now supports a `resetPlanner` action that:

- deletes all current tasks
- deletes all current categories stored in `Broad Heads`
- clears history
- reseeds the default categories:
  - Work
  - Personal
  - Health
  - Events & Meetings

The app exposes this through the reset button in the header after deployment.

## Local development

```powershell
npm install
npm run dev:netlify
```

## Production build

```powershell
npm run build
```
