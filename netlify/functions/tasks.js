const crypto = require("crypto");
const { google } = require("googleapis");

const TASK_HEADERS = [
  "id",
  "title",
  "notes",
  "category",
  "status",
  "dueAt",
  "reminderAt",
  "createdAt",
  "updatedAt",
  "completedAt",
];

const HISTORY_HEADERS = [
  "timestamp",
  "taskId",
  "action",
  "title",
  "category",
  "status",
  "dueAt",
  "reminderAt",
  "payload",
];

const TASK_SHEET = "Tasks";
const HISTORY_SHEET = "History";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const config = getConfig();
    const sheets = await createSheetsClient(config);
    const metadata = await ensureSheetsStructure(sheets, config.spreadsheetId);

    if (event.httpMethod === "GET") {
      const action = event.queryStringParameters?.action || "list";
      if (action !== "list") {
        return response(400, { ok: false, error: "Unsupported action." }, headers);
      }

      const tasks = await listTasks(sheets, config.spreadsheetId);
      return response(200, { ok: true, tasks }, headers);
    }

    if (event.httpMethod !== "POST") {
      return response(405, { ok: false, error: "Method not allowed." }, headers);
    }

    const payload = JSON.parse(event.body || "{}");
    if (payload.action === "save") {
      const task = await saveTask(sheets, config.spreadsheetId, payload.task || {});
      return response(200, { ok: true, task }, headers);
    }

    if (payload.action === "delete") {
      await deleteTask(sheets, config.spreadsheetId, metadata, payload.id);
      return response(200, { ok: true }, headers);
    }

    return response(400, { ok: false, error: "Unsupported action." }, headers);
  } catch (error) {
    return response(500, { ok: false, error: error.message }, headers);
  }
};

function response(statusCode, body, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error("Missing Google Sheets environment variables.");
  }

  return {
    spreadsheetId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

async function createSheetsClient(config) {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

async function ensureSheetsStructure(sheets, spreadsheetId) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const existingSheets = spreadsheet.data.sheets || [];
  const titles = new Map(existingSheets.map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
  const requests = [];

  if (!titles.has(TASK_SHEET)) {
    requests.push({ addSheet: { properties: { title: TASK_SHEET } } });
  }

  if (!titles.has(HISTORY_SHEET)) {
    requests.push({ addSheet: { properties: { title: HISTORY_SHEET } } });
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  const refreshed = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const sheetMap = new Map(
    (refreshed.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId])
  );

  await ensureHeaders(sheets, spreadsheetId, TASK_SHEET, TASK_HEADERS);
  await ensureHeaders(sheets, spreadsheetId, HISTORY_SHEET, HISTORY_HEADERS);

  return {
    taskSheetId: sheetMap.get(TASK_SHEET),
    historySheetId: sheetMap.get(HISTORY_SHEET),
  };
}

async function ensureHeaders(sheets, spreadsheetId, sheetName, headers) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const firstRow = existing.data.values?.[0] || [];
  const matches = headers.every((header, index) => firstRow[index] === header);
  if (matches) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [headers],
    },
  });
}

async function listTasks(sheets, spreadsheetId) {
  const rows = await getTaskRows(sheets, spreadsheetId);
  return rows.map((row) => row.task);
}

async function getTaskRows(sheets, spreadsheetId) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TASK_SHEET}!A2:J`,
  });

  const values = result.data.values || [];
  return values
    .map((row, index) => ({
      rowNumber: index + 2,
      task: rowToTask(row),
    }))
    .filter((entry) => entry.task.id);
}

async function saveTask(sheets, spreadsheetId, input) {
  const existingRows = await getTaskRows(sheets, spreadsheetId);
  const current = existingRows.find((entry) => entry.task.id === input.id)?.task;
  const now = new Date().toISOString();
  const task = normalizeTask(input, current, now);
  const rowValues = taskToRow(task);
  const existingRow = existingRows.find((entry) => entry.task.id === task.id);

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TASK_SHEET}!A${existingRow.rowNumber}:J${existingRow.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues],
      },
    });
    await appendHistory(sheets, spreadsheetId, "updated", task);
    return task;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TASK_SHEET}!A:J`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues],
    },
  });
  await appendHistory(sheets, spreadsheetId, "created", task);
  return task;
}

async function deleteTask(sheets, spreadsheetId, metadata, taskId) {
  if (!taskId) {
    throw new Error("Task id is required.");
  }

  const existingRows = await getTaskRows(sheets, spreadsheetId);
  const match = existingRows.find((entry) => entry.task.id === taskId);
  if (!match) {
    throw new Error("Task not found.");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: metadata.taskSheetId,
              dimension: "ROWS",
              startIndex: match.rowNumber - 1,
              endIndex: match.rowNumber,
            },
          },
        },
      ],
    },
  });

  await appendHistory(sheets, spreadsheetId, "deleted", match.task);
}

async function appendHistory(sheets, spreadsheetId, action, task) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${HISTORY_SHEET}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        new Date().toISOString(),
        task.id || "",
        action,
        task.title || "",
        task.category || "",
        task.status || "",
        task.dueAt || "",
        task.reminderAt || "",
        JSON.stringify(task),
      ]],
    },
  });
}

function normalizeTask(input, current, now) {
  if (!input.title) {
    throw new Error("Task title is required.");
  }

  if (!input.category) {
    throw new Error("Task category is required.");
  }

  if (!input.dueAt) {
    throw new Error("Task due time is required.");
  }

  const status = input.status === "completed" ? "completed" : "open";
  return {
    id: input.id || current?.id || crypto.randomUUID(),
    title: String(input.title).trim(),
    notes: String(input.notes || "").trim(),
    category: String(input.category).trim(),
    status,
    dueAt: String(input.dueAt).trim(),
    reminderAt: String(input.reminderAt || "").trim(),
    createdAt: input.createdAt || current?.createdAt || now,
    updatedAt: now,
    completedAt: status === "completed" ? (input.completedAt || current?.completedAt || now) : "",
  };
}

function taskToRow(task) {
  return TASK_HEADERS.map((header) => task[header] || "");
}

function rowToTask(row) {
  const task = {};
  TASK_HEADERS.forEach((header, index) => {
    task[header] = row[index] || "";
  });
  return task;
}
