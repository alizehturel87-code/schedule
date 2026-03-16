const fs = require("fs");
const path = require("path");

loadEnv(path.join(__dirname, "..", ".env"));

const { handler } = require("../netlify/functions/tasks");

async function main() {
  const response = await handler({
    httpMethod: "GET",
    queryStringParameters: { action: "list" },
  });

  console.log(response.statusCode);
  console.log(response.body);
}

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
