import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join, relative, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const INSFORGE_URL = "https://cpd9mnqf.ap-southeast.insforge.app";
const API_KEY = "ik_edebac0bcdf5888116829062d67682ce";
const PROJECT_ID = "cpd9mnqf";

const ENV_VARS = [
  { key: "NEXT_PUBLIC_INSFORGE_URL", value: "https://cpd9mnqf.ap-southeast.insforge.app" },
  { key: "NEXT_PUBLIC_INSFORGE_ANON_KEY", value: "anon_34290d5cd8a56b6f0a9885ad57385af0fe4d38bd8fe02104e94f3f36d8b705e2" },
  { key: "NEXT_PUBLIC_SITE_URL", value: "https://pradipbooks.insforge.site" },
];

async function insforge(method, path, body) {
  const url = `${INSFORGE_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InsForge ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

function collectFiles(dir, results) {
  if (!results) results = [];
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    if (name === "node_modules" || name === ".next" || name === ".git" || name.startsWith(".")) continue;
    if (statSync(fullPath).isDirectory()) {
      collectFiles(fullPath, results);
    } else {
      const ext = extname(fullPath);
      if (![".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html", ".md", ".mjs", ".png", ".jpg", ".svg", ".ico", ".txt"].includes(ext)) continue;
      results.push({ path: fullPath, relativePath: relative(ROOT, fullPath).replace(/\\/g, "/") });
    }
  }
  return results;
}

async function main() {
  console.log("Collecting files...");
  const files = collectFiles(ROOT);
  console.log(`${files.length} files`);

  const fileData = files.map(({ path: filePath, relativePath }) => ({
    path: relativePath,
    content: readFileSync(filePath, "utf-8"),
  }));

  console.log("Creating deployment...");
  const { deploymentId } = await insforge("POST", `/api/projects/${PROJECT_ID}/deployments/upload`, {});
  console.log(`Deployment ID: ${deploymentId}`);

  console.log("Uploading files (10 per batch)...");
  for (let i = 0; i < fileData.length; i += 10) {
    const batch = fileData.slice(i, i + 10);
    await insforge("POST", `/api/projects/${PROJECT_ID}/deployments/${deploymentId}/files/batch`, { files: batch });
    console.log(`  ${Math.min(i + 10, fileData.length)}/${fileData.length}`);
  }

  console.log("Starting build...");
  const startRes = await insforge("POST", `/api/projects/${PROJECT_ID}/deployments/${deploymentId}/start`, {
    envVars: ENV_VARS,
  });
  console.log(`Build started! URL: https://${PROJECT_ID}.insforge.site`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    const status = await insforge("GET", `/api/projects/${PROJECT_ID}/deployments/${deploymentId}/status`);
    console.log(`  Status: ${status.status}`);
    if (status.status === "ready" || status.status === "success") {
      console.log(`Deployed! https://${PROJECT_ID}.insforge.site`);
      break;
    }
    if (status.status === "failed") {
      console.error("Build failed:", status.error);
      break;
    }
  }
}

main().catch(console.error);
