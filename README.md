# Orbit Tasks

Orbit Tasks is a personal to-do web app with:

- your five fixed task categories
- a category board and a calendar view
- browser notifications when a task reaches its due time
- Google Sheets as the only database
- Netlify Functions as the server-side bridge

## Project files

- `index.html`: app structure
- `styles.css`: visual design
- `app.js`: task logic, calendar rendering, due-time notifications, and API calls
- `netlify/functions/tasks.js`: Netlify Function that reads and writes Google Sheets
- `netlify.toml`: Netlify config
- `package.json`: dependencies and local dev scripts

## Categories

- Ultra important to be completed in next 12 hrs
- Important to be done in next 24 hrs
- Weekend Tasks
- Meetings and events to reach on time
- Do it at your leisure

## Google Sheets structure

The Netlify Function creates and maintains two tabs:

- `Tasks`: live task records
- `History`: create, update, and delete history

## Google setup

1. Create a Google Sheet for this app.
2. In Google Cloud, create or reuse a project.
3. Enable the `Google Sheets API` for that project.
4. Create a `Service Account`.
5. Generate a JSON key for that service account.
6. Share your Google Sheet with the service account email as an editor.

## Netlify environment variables

Set these in Netlify Site Settings -> Environment Variables:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

For the private key, paste the full key including line breaks. If Netlify stores it with escaped `\n`, the function normalizes it.

## Deploy to Netlify

1. Push this repo to GitHub.
2. Import the repo into Netlify.
3. Netlify will detect [netlify.toml](/e:/Schedule/netlify.toml).
4. Set the three Google environment variables.
5. Trigger a deploy.
6. Open the deployed site and start using the app.

## Local development

Use Netlify CLI so the frontend can reach the serverless function:

```powershell
npm install
npx netlify dev
```

Then open the local URL printed by Netlify.

## Notes

- opening `index.html` directly as a `file://` URL will not work because the app expects the Netlify Function route
- due-time notifications only fire while the page is open
- the Google Sheet remains the full source of truth and history
