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

// somehow the pi agents session jsonl logfiles sometimes have two json objects on the same line, breaking a simple readline-parsejson loop
// this simple state machine runs over the jsonl file string and cleans that up
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

async function processSessionFile(filePath) {
  const rawContent = fs.readFileSync(filePath).toString();
  const sanitized = formatJsonString(rawContent);

  const costsByModel = new Map();

  for await (const line of sanitized.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line);
      const cost = entry?.message?.usage?.cost;
      const model = entry?.message?.model;

      if (cost !== undefined) {
        costsByModel.set(model, costsByModel.get(model) ?? 0 + cost.total);
      }
    } catch (e) {
      console.log("errorneous line:", line);
      throw e;
    }
  }

  return { costsByModel };
}

async function generateReport() {
  const sessionFiles = await getSessionFiles(SESSIONS_DIR);

  for (const filePath of sessionFiles) {
    const { costsByModel, totalSessionCost } =
      await processSessionFile(filePath);

    console.log(costsByModel);
  }
}

generateReport().catch(console.error);
