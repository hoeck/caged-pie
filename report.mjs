import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { inspect } from "util";

inspect.defaultOptions.depth = 255;

const SESSIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".pi/agent/sessions/",
);

async function getSessionFiles(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        return getSessionFiles(res);
      } else {
        return res.endsWith(".jsonl") ? res : null;
      }
    }),
  );
  return files.flat().filter((file) => file !== null);
}

function formatJsonString(jsonString) {
  const states = {
    OUTSIDE_OBJECT: "OUTSIDE_OBJECT",
    INSIDE_OBJECT: "INSIDE_OBJECT",
    INSIDE_STRING: "INSIDE_STRING",
  };

  let currentState = states.OUTSIDE_OBJECT;
  let braceLevel = 0;
  let currentObject = "";
  const jsonObjects = [];

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    switch (currentState) {
      case states.OUTSIDE_OBJECT:
        if (char === "{") {
          currentState = states.INSIDE_OBJECT;
          braceLevel++;
          currentObject += char;
        }
        break;

      case states.INSIDE_OBJECT:
        currentObject += char;
        if (char === '"') {
          currentState = states.INSIDE_STRING;
        } else if (char === "{") {
          braceLevel++;
        } else if (char === "}") {
          braceLevel--;
          if (braceLevel === 0) {
            currentState = states.OUTSIDE_OBJECT;
            jsonObjects.push(currentObject);
            currentObject = "";
          }
        }
        break;

      case states.INSIDE_STRING:
        currentObject += char;
        if (char === '"' && jsonString[i - 1] !== "\\") {
          currentState = states.INSIDE_OBJECT;
        }
        break;
    }
  }

  return jsonObjects.join("\n");
}

function getMessageModelAndCost(message) {
  const cost = message?.usage?.cost;
  const model = message?.model;

  return { cost, model };
}

async function processSessionFile(filePath) {
  const rawContent = fs.readFileSync(filePath).toString();
  const sanitized = formatJsonString(rawContent);

  const costsByModel = new Map();
  const lines = sanitized.split("\n");
  let sessionStart;

  for (const line of sanitized.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    let entry;

    try {
      entry = JSON.parse(line);
    } catch (e) {
      console.log(line);

      throw e;
    }

    if (entry.type === "session") {
      sessionStart = entry.timestamp;
    }

    const { cost, model } = getMessageModelAndCost(entry?.message);

    if (cost !== undefined) {
      costsByModel.set(model, (costsByModel.get(model) ?? 0) + cost.total);
    }

    if (
      entry?.message?.toolName === "subagent" &&
      entry?.message?.details?.results
    ) {
      for (const result of entry.message.details.results) {
        if (result.messages) {
          for (const subagentMessage of result.messages) {
            const { cost: subagentCost, model: subagentModel } =
              getMessageModelAndCost(subagentMessage);

            if (subagentCost !== undefined) {
              costsByModel.set(
                subagentModel,
                (costsByModel.get(subagentModel) ?? 0) + subagentCost.total,
              );
            }
          }
        }
      }
    }
  }

  return { costsByModel, sessionStart };
}

function formatTable(data) {
  if (data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  const columnWidths = headers.map((header) => header.length);

  data.forEach((row) => {
    Object.values(row).forEach((value, index) => {
      const valueString = String(value);
      if (valueString.length > columnWidths[index]) {
        columnWidths[index] = valueString.length;
      }
    });
  });

  let tableString = "";
  const headerRow = headers
    .map((header, index) => header.padEnd(columnWidths[index]))
    .join("   ");
  tableString += headerRow + "\n";

  const separator = columnWidths.map((width) => "-".repeat(width)).join("   ");
  tableString += separator + "\n";

  data.forEach((row) => {
    const rowString = Object.values(row)
      .map((value, index) => {
        if (String(value).includes("-------")) {
          return "-".repeat(columnWidths[index]);
        }
        return String(value).padEnd(columnWidths[index]);
      })
      .join("   ");
    tableString += rowString + "\n";
  });

  return tableString;
}

async function generateReport() {
  const sessionFiles = await getSessionFiles(SESSIONS_DIR);
  const reportData = [];
  let totalCostAllSessions = 0;
  const totalCostPerModelAllSessions = new Map();

  for (const filePath of sessionFiles) {
    const { costsByModel, sessionStart } = await processSessionFile(filePath);
    if (!sessionStart || costsByModel.size === 0) {
      continue;
    }

    if (reportData.length > 0) {
      reportData.push({ Session: "", Model: "", Cost: "" });
    }

    const sessionLabel = new Date(sessionStart)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");

    let totalSessionCost = 0;
    let isFirstRowForThisSession = true;

    costsByModel.forEach((cost, model) => {
      totalSessionCost += cost;
      totalCostPerModelAllSessions.set(
        model,
        (totalCostPerModelAllSessions.get(model) ?? 0) + cost,
      );
      reportData.push({
        Session: isFirstRowForThisSession ? sessionLabel : "",
        Model: model,
        Cost: `$${cost.toFixed(4)}`,
      });
      isFirstRowForThisSession = false;
    });

    reportData.push({
      Session: "",
      Model: "",
      Cost: "-------",
    });

    reportData.push({
      Session: "",
      Model: "Total",
      Cost: `$${totalSessionCost.toFixed(4)}`,
    });

    totalCostAllSessions += totalSessionCost;
  }

  console.log("--- Session Cost Report ---");
  console.log(formatTable(reportData));

  const modelSummary = [];
  totalCostPerModelAllSessions.forEach((cost, model) => {
    modelSummary.push({ Model: model, "Total Cost": `$${cost.toFixed(4)}` });
  });

  console.log("\n--- Overall Summary ---");
  console.log(formatTable(modelSummary));
  console.log(
    `\nGrand Total (All Sessions): $${totalCostAllSessions.toFixed(4)}`,
  );
}
generateReport().catch(console.error);
