const crypto = require("crypto");
const { google } = require("googleapis");

const TASK_HEADERS = [
  "id",
  "title",
  "notes",
  "category",
  "broadHeadId",
  "broadHeadTitle",
  "status",
  "dueAt",
  "createdAt",
  "updatedAt",
  "completedAt",
];

const BROAD_HEAD_HEADERS = [
  "id",
  "title",
  "notes",
  "createdAt",
  "updatedAt",
];

const HISTORY_HEADERS = [
  "timestamp",
  "entityType",
  "entityId",
  "action",
  "title",
  "category",
  "broadHeadTitle",
  "status",
  "dueAt",
  "payload",
];

const TASK_SHEET = "Tasks";
const BROAD_HEAD_SHEET = "Broad Heads";
const HISTORY_SHEET = "History";
const DEFAULT_CATEGORY_SEEDS = [
  {
    id: "work",
    title: "Work",
    notes: JSON.stringify({ emoji: "\uD83D\uDCBC", color: "#ef8f35", system: true }),
  },
  {
    id: "personal",
    title: "Personal",
    notes: JSON.stringify({ emoji: "\uD83C\uDFE0", color: "#2f9b74", system: true }),
  },
  {
    id: "health",
    title: "Health",
    notes: JSON.stringify({ emoji: "\uD83D\uDCAA", color: "#d1a321", system: true }),
  },
  {
    id: "events",
    title: "Events & Meetings",
    notes: JSON.stringify({ emoji: "\uD83D\uDCC5", color: "#d95f5f", system: true }),
  },
];

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

      let broadHeads = await listBroadHeads(sheets, config.spreadsheetId);
      if (!broadHeads.length) {
        broadHeads = await seedDefaultBroadHeads(sheets, config.spreadsheetId);
      }
      const tasks = await listTasks(sheets, config.spreadsheetId);

      return response(200, { ok: true, tasks, broadHeads }, headers);
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

    if (payload.action === "saveHead") {
      const broadHead = await saveBroadHead(sheets, config.spreadsheetId, payload.head || {});
      return response(200, { ok: true, broadHead }, headers);
    }

    if (payload.action === "deleteHead") {
      await deleteBroadHead(sheets, config.spreadsheetId, metadata, payload.id);
      return response(200, { ok: true }, headers);
    }

    if (payload.action === "resetPlanner") {
      const data = await resetPlanner(sheets, config.spreadsheetId);
      return response(200, { ok: true, ...data }, headers);
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

  if (!titles.has(BROAD_HEAD_SHEET)) {
    requests.push({ addSheet: { properties: { title: BROAD_HEAD_SHEET } } });
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

  await ensureSheetSchema(sheets, spreadsheetId, TASK_SHEET, TASK_HEADERS);
  await ensureSheetSchema(sheets, spreadsheetId, BROAD_HEAD_SHEET, BROAD_HEAD_HEADERS);
  await ensureSheetSchema(sheets, spreadsheetId, HISTORY_SHEET, HISTORY_HEADERS);

  return {
    taskSheetId: sheetMap.get(TASK_SHEET),
    broadHeadSheetId: sheetMap.get(BROAD_HEAD_SHEET),
    historySheetId: sheetMap.get(HISTORY_SHEET),
  };
}

async function ensureSheetSchema(sheets, spreadsheetId, sheetName, nextHeaders) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const values = result.data.values || [];
  const existingHeaders = values[0] || [];

  if (headersMatch(existingHeaders, nextHeaders)) {
    return;
  }

  const migratedRows = values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => remapRow(existingHeaders, row, nextHeaders));

  await replaceSheetRows(sheets, spreadsheetId, sheetName, nextHeaders, migratedRows);
}

function headersMatch(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return right.every((header, index) => left[index] === header);
}

function remapRow(existingHeaders, row, nextHeaders) {
  const source = {};
  existingHeaders.forEach((header, index) => {
    source[header] = row[index] || "";
  });
  return nextHeaders.map((header) => source[header] || "");
}

async function listTasks(sheets, spreadsheetId) {
  const rows = await getTaskRows(sheets, spreadsheetId);
  return rows.map((row) => row.task);
}

async function listBroadHeads(sheets, spreadsheetId) {
  const rows = await getBroadHeadRows(sheets, spreadsheetId);
  return rows.map((row) => row.broadHead);
}

async function getTaskRows(sheets, spreadsheetId) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TASK_SHEET}!A:Z`,
  });

  const values = result.data.values || [];
  const headers = values[0] || TASK_HEADERS;

  return values
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      task: rowToRecord(row, headers),
    }))
    .filter((entry) => entry.task.id);
}

async function getBroadHeadRows(sheets, spreadsheetId) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${BROAD_HEAD_SHEET}!A:Z`,
  });

  const values = result.data.values || [];
  const headers = values[0] || BROAD_HEAD_HEADERS;

  return values
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      broadHead: rowToRecord(row, headers),
    }))
    .filter((entry) => entry.broadHead.id);
}

async function seedDefaultBroadHeads(sheets, spreadsheetId) {
  const now = new Date().toISOString();
  const seeded = DEFAULT_CATEGORY_SEEDS.map((item) => ({
    id: item.id,
    title: item.title,
    notes: item.notes,
    createdAt: now,
    updatedAt: now,
  }));

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${BROAD_HEAD_SHEET}!A:${columnLetter(BROAD_HEAD_HEADERS.length)}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: seeded.map((record) => recordToRow(record, BROAD_HEAD_HEADERS)),
    },
  });

  return seeded;
}

async function saveTask(sheets, spreadsheetId, input) {
  const [existingRows, broadHeadRows] = await Promise.all([
    getTaskRows(sheets, spreadsheetId),
    getBroadHeadRows(sheets, spreadsheetId),
  ]);

  const current = existingRows.find((entry) => entry.task.id === input.id)?.task;
  const broadHeadMap = new Map(broadHeadRows.map((entry) => [entry.broadHead.id, entry.broadHead]));
  const now = new Date().toISOString();
  const task = normalizeTask(input, current, now, broadHeadMap);
  const rowValues = recordToRow(task, TASK_HEADERS);
  const existingRow = existingRows.find((entry) => entry.task.id === task.id);

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TASK_SHEET}!A${existingRow.rowNumber}:${columnLetter(TASK_HEADERS.length)}${existingRow.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues],
      },
    });
    await appendHistory(sheets, spreadsheetId, "task", "updated", task);
    return task;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TASK_SHEET}!A:${columnLetter(TASK_HEADERS.length)}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues],
    },
  });
  await appendHistory(sheets, spreadsheetId, "task", "created", task);
  return task;
}

async function saveBroadHead(sheets, spreadsheetId, input) {
  const existingRows = await getBroadHeadRows(sheets, spreadsheetId);
  const current = existingRows.find((entry) => entry.broadHead.id === input.id)?.broadHead;
  const now = new Date().toISOString();
  const broadHead = normalizeBroadHead(input, current, now);
  const rowValues = recordToRow(broadHead, BROAD_HEAD_HEADERS);
  const existingRow = existingRows.find((entry) => entry.broadHead.id === broadHead.id);

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${BROAD_HEAD_SHEET}!A${existingRow.rowNumber}:${columnLetter(BROAD_HEAD_HEADERS.length)}${existingRow.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [rowValues],
      },
    });
    await appendHistory(sheets, spreadsheetId, "broad_head", "updated", broadHead);
    return broadHead;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${BROAD_HEAD_SHEET}!A:${columnLetter(BROAD_HEAD_HEADERS.length)}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues],
    },
  });
  await appendHistory(sheets, spreadsheetId, "broad_head", "created", broadHead);
  return broadHead;
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

  await appendHistory(sheets, spreadsheetId, "task", "deleted", match.task);
}

async function deleteBroadHead(sheets, spreadsheetId, metadata, broadHeadId) {
  if (!broadHeadId) {
    throw new Error("Broad head id is required.");
  }

  const [headRows, taskRows] = await Promise.all([
    getBroadHeadRows(sheets, spreadsheetId),
    getTaskRows(sheets, spreadsheetId),
  ]);

  const match = headRows.find((entry) => entry.broadHead.id === broadHeadId);
  if (!match) {
    throw new Error("Broad head not found.");
  }

  const hasTasks = taskRows.some((entry) => entry.task.broadHeadId === broadHeadId);
  if (hasTasks) {
    throw new Error("This broad head still has tasks. Reassign or delete those tasks first.");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: metadata.broadHeadSheetId,
              dimension: "ROWS",
              startIndex: match.rowNumber - 1,
              endIndex: match.rowNumber,
            },
          },
        },
      ],
    },
  });

  await appendHistory(sheets, spreadsheetId, "broad_head", "deleted", match.broadHead);
}

async function resetPlanner(sheets, spreadsheetId) {
  const now = new Date().toISOString();
  const seededBroadHeads = DEFAULT_CATEGORY_SEEDS.map((item) => ({
    id: item.id,
    title: item.title,
    notes: item.notes,
    createdAt: now,
    updatedAt: now,
  }));

  await replaceSheetRows(sheets, spreadsheetId, TASK_SHEET, TASK_HEADERS, []);
  await replaceSheetRows(
    sheets,
    spreadsheetId,
    BROAD_HEAD_SHEET,
    BROAD_HEAD_HEADERS,
    seededBroadHeads.map((item) => recordToRow(item, BROAD_HEAD_HEADERS))
  );
  await replaceSheetRows(sheets, spreadsheetId, HISTORY_SHEET, HISTORY_HEADERS, []);

  return {
    tasks: [],
    broadHeads: seededBroadHeads,
  };
}

async function replaceSheetRows(sheets, spreadsheetId, sheetName, headers, rows) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [headers, ...rows],
    },
  });
}

async function appendHistory(sheets, spreadsheetId, entityType, action, item) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${HISTORY_SHEET}!A:${columnLetter(HISTORY_HEADERS.length)}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        new Date().toISOString(),
        entityType,
        item.id || "",
        action,
        item.title || "",
        item.category || "",
        item.broadHeadTitle || "",
        item.status || "",
        item.dueAt || "",
        JSON.stringify(item),
      ]],
    },
  });
}

function normalizeTask(input, current, now, broadHeadMap) {
  if (!input.title) {
    throw new Error("Task title is required.");
  }

  const status = input.status === "completed" ? "completed" : "open";
  const broadHeadId = String(input.broadHeadId || current?.broadHeadId || "").trim();
  const broadHeadTitle = broadHeadId
    ? String(broadHeadMap.get(broadHeadId)?.title || input.broadHeadTitle || current?.broadHeadTitle || "").trim()
    : "";

  if (broadHeadId && !broadHeadTitle) {
    throw new Error("Category not found.");
  }

  return {
    id: input.id || current?.id || crypto.randomUUID(),
    title: String(input.title).trim(),
    notes: String(input.notes || "").trim(),
    category: String(input.category || current?.category || "open").trim(),
    broadHeadId,
    broadHeadTitle,
    status,
    dueAt: String(input.dueAt || "").trim(),
    createdAt: input.createdAt || current?.createdAt || now,
    updatedAt: now,
    completedAt: status === "completed" ? (input.completedAt || current?.completedAt || now) : "",
  };
}

function normalizeBroadHead(input, current, now) {
  if (!input.title) {
    throw new Error("Broad head title is required.");
  }

  return {
    id: input.id || current?.id || crypto.randomUUID(),
    title: String(input.title).trim(),
    notes: String(input.notes || "").trim(),
    createdAt: input.createdAt || current?.createdAt || now,
    updatedAt: now,
  };
}

function recordToRow(record, headers) {
  return headers.map((header) => record[header] || "");
}

function rowToRecord(row, headers) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = row[index] || "";
  });
  return record;
}

function columnLetter(index) {
  let current = index;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}
