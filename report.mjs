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

async function processSessionFile(filePath) {
  const rawContent = fs.readFileSync(filePath).toString();
  const sanitized = rawContent.replaceAll("}{", "}\n{");

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
