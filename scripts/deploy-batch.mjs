// Batch deploy: uploads files in small groups to avoid timeouts on slow networks.
// Usage: node scripts/deploy-batch.mjs [batchSize]
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const API_BASE_URL = requiredEnv("NEXT_PUBLIC_INSFORGE_URL");
const API_KEY = requiredEnv("INSFORGE_API_KEY");
const BATCH_SIZE = Number.parseInt(process.argv[2] || "5", 10);

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const EXCLUDED_SEGMENTS = new Set(["node_modules", ".git", ".next", "dist", "build", ".insforge"]);

const DEPLOY_ENV_KEYS = [
  "NEXT_PUBLIC_INSFORGE_URL",
  "NEXT_PUBLIC_INSFORGE_ANON_KEY",
  "INSFORGE_SERVICE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NAGORIKPAY_API_KEY",
  "NAGORIKPAY_BASE_URL",
  "NAGORIKPAY_WEBHOOK_SECRET",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
];

let localEnvFile = new Map();
try {
  const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)) {
      value = value.slice(1, -1);
    }
    localEnvFile.set(match[1], value);
  }
} catch {}

function envValue(key) {
  return process.env[key] ?? localEnvFile.get(key) ?? "";
}

function shouldExcludeDeploymentPath(normalizedName) {
  const segments = normalizedName.split("/");
  if (segments.some((s) => s === ".env" || s.startsWith(".env."))) return true;
  if (segments.some((s) => EXCLUDED_SEGMENTS.has(s))) return true;
  return normalizedName === ".DS_Store" || normalizedName.endsWith("/.DS_Store") || normalizedName.endsWith(".log");
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) {
    const message = data && typeof data === "object" ? data.message || data.error : null;
    throw new Error(message || "Request failed with status " + response.status);
  }
  return data;
}

async function api(pathname, init = {}) {
  const headers = { "x-api-key": API_KEY, ...(init.headers || {}) };
  const response = await fetch(API_BASE_URL + pathname, { ...init, headers });
  return readJsonResponse(response);
}

async function hashFile(filePath) {
  const hash = createHash("sha1");
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    size += chunk.length;
    hash.update(chunk);
  }
  return { sha: hash.digest("hex"), size };
}

async function collectFiles(rootDirectory) {
  const files = [];
  async function walk(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const normalizedPath = path.relative(rootDirectory, absolutePath).split(path.sep).join("/").replace(/\\/g, "/");
      if (!normalizedPath || shouldExcludeDeploymentPath(normalizedPath)) continue;
      if (entry.isDirectory()) { await walk(absolutePath); continue; }
      if (!entry.isFile()) continue;
      const { sha, size } = await hashFile(absolutePath);
      files.push({ absolutePath, path: normalizedPath, sha, size });
    }
  }
  await walk(rootDirectory);
  return files;
}

async function uploadFile(deploymentId, manifestFile, localFile) {
  const response = await fetch(
    API_BASE_URL + "/api/deployments/" + encodeURIComponent(deploymentId) + "/files/" + encodeURIComponent(manifestFile.fileId) + "/content",
    {
      method: "PUT",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/octet-stream", "Content-Length": String(localFile.size) },
      body: createReadStream(localFile.absolutePath),
      duplex: "half",
    }
  );
  await readJsonResponse(response);
}

const rootDirectory = process.cwd();
const localFiles = await collectFiles(rootDirectory);
console.log("Total files to deploy: " + localFiles.length);

const createResult = await api("/api/deployments/direct", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ files: localFiles.map(({ path, sha, size }) => ({ path, sha, size })) }),
});

const deploymentId = createResult.id;
const localFileByPath = new Map(localFiles.map((file) => [file.path, file]));
console.log("Created deployment: " + deploymentId);
console.log("Uploading in batches of " + BATCH_SIZE + "...");

let uploaded = 0;
for (let i = 0; i < createResult.files.length; i += BATCH_SIZE) {
  const batch = createResult.files.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(async (manifestFile) => {
    const localFile = localFileByPath.get(manifestFile.path);
    if (!localFile) throw new Error("Unknown file: " + manifestFile.path);
    if (localFile.sha !== manifestFile.sha || localFile.size !== manifestFile.size) {
      throw new Error("Metadata mismatch: " + manifestFile.path);
    }
    await uploadFile(deploymentId, manifestFile, localFile);
  }));
  uploaded += batch.length;
  console.log("  Uploaded " + uploaded + "/" + createResult.files.length);
}

console.log("All files uploaded. Starting build...");
const envVars = DEPLOY_ENV_KEYS
  .filter((key) => envValue(key))
  .map((key) => ({ key, value: envValue(key) }));

const startResult = await api("/api/deployments/" + encodeURIComponent(deploymentId) + "/start", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ envVars }),
});
console.log("Build started:", JSON.stringify(startResult));
console.log("DEPLOYMENT_ID=" + deploymentId);
