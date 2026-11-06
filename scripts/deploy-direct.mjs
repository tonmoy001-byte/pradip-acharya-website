import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

// Load .env.local before requiredEnv runs so --env-file is not required.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      if (process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch {
    // .env.local optional
  }
}

const API_BASE_URL = requiredEnv("NEXT_PUBLIC_INSFORGE_URL");

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

function resolveApiKey() {
  if (process.env.INSFORGE_API_KEY) return process.env.INSFORGE_API_KEY;
  try {
    // Fallback to project metadata without printing the value.
  } catch {}
  // Read from .insforge/project.json if present.
  try {
    const raw = fs.readFileSync
      ? null
      : null;
  } catch {}
  return process.env.INSFORGE_API_KEY;
}

// Simplify: read api key from project.json synchronously via fs/promises is async; handle below.
async function getApiKey() {
  if (process.env.INSFORGE_API_KEY) return process.env.INSFORGE_API_KEY;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".insforge", "project.json"), "utf8");
    const project = JSON.parse(raw);
    if (project?.api_key) return project.api_key;
  } catch {}
  throw new Error("INSFORGE_API_KEY is not set (see .env.example)");
}

// Re-evaluate API_KEY asynchronously is awkward at top; instead make api() read a mutable key.
let resolvedApiKey = null;
async function ensureApiKey() {
  if (resolvedApiKey) return resolvedApiKey;
  resolvedApiKey = await getApiKey();
  return resolvedApiKey;
}

const DEFAULT_UPLOAD_CONCURRENCY = 3;
const MAX_UPLOAD_CONCURRENCY = 32;
const EXCLUDED_SEGMENTS = new Set(["node_modules", ".git", ".next", "dist", "build", ".insforge", ".vercel", ".kilo"]);

const REQUIRED_ENV = [
  "NEXT_PUBLIC_INSFORGE_URL",
  "NEXT_PUBLIC_INSFORGE_ANON_KEY",
  "INSFORGE_SERVICE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "APP_URL",
  "NAGORIKPAY_API_KEY",
  "NAGORIKPAY_BASE_URL",
  "NAGORIKPAY_WEBHOOK_SECRET",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
];
const OPTIONAL_ENV = [
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_WHATSAPP_NUMBER",
  "NEXT_PUBLIC_GA_ID",
];
const DEPLOY_ENV_KEYS = [...REQUIRED_ENV, ...OPTIONAL_ENV];

let localEnvFile = new Map();

function envValue(key) {
  return process.env[key] ?? localEnvFile.get(key) ?? "";
}

function buildEnvVars() {
  const missing = REQUIRED_ENV.filter((key) => !envValue(key));
  if (missing.length) {
    console.error("Missing required deploy env vars: " + missing.join(", "));
    process.exit(1);
  }
  const appUrl = envValue("APP_URL");
  if (/localhost|127\.0\.0\.1/.test(appUrl)) {
    console.error("APP_URL must not point to localhost in production (got " + appUrl + ")");
    process.exit(1);
  }
  const envVars = [];
  for (const key of DEPLOY_ENV_KEYS) {
    const value = envValue(key);
    if (!value) {
      console.warn("Skipping optional deploy env var with no local value: " + key);
      continue;
    }
    envVars.push({ key, value });
  }
  return envVars;
}

function shouldExcludeDeploymentPath(normalizedName) {
  const segments = normalizedName.split("/");
  if (segments.some((segment) => segment === ".env" || segment.startsWith(".env."))) return true;
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return true;
  return normalizedName === ".DS_Store" || normalizedName.endsWith("/.DS_Store") || normalizedName.endsWith(".log");
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" ? data.message || data.error : null;
    throw new Error(message || "Request failed with status " + response.status);
  }
  return data;
}

const RETRYABLE_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);
const RETRYABLE_STATUSES = new Set([408, 429]);

function isRetryableError(err) {
  if (!err) return false;
  const code = err.code || err.cause?.code;
  if (code && RETRYABLE_CODES.has(code)) return true;
  if (typeof err.message === "string" && /fetch failed/i.test(err.message)) return true;
  const status = err.status;
  if (status && (RETRYABLE_STATUSES.has(status) || status >= 500)) return true;
  return false;
}

async function withRetry(label, fn, { timeoutMs = 120000 } = {}) {
  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const retryable = isRetryableError(err);
      const retryableStatus = status && (RETRYABLE_STATUSES.has(status) || status >= 500);
      if (!retryable && !retryableStatus) throw err;
      if (attempt === maxAttempts) throw err;
      const delay = Math.round(1500 * Math.pow(2, attempt - 1) + Math.random() * 500);
      const code = err?.code || err?.cause?.code || status || "fetch failed";
      console.warn(`retry ${attempt}/${maxAttempts} for ${label} in ${delay}ms (${code})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function api(pathname, init = {}, label = pathname) {
  const key = await ensureApiKey();
  const headers = { "x-api-key": key, ...(init.headers || {}) };
  const response = await fetch(API_BASE_URL + pathname, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(120000),
  });
  let data = null;
  const text = await response.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" ? data.message || data.error : null;
    const err = new Error(message || "Request failed with status " + response.status);
    err.status = response.status;
    throw err;
  }
  return data;
}

function getUploadConcurrency() {
  const parsed = Number.parseInt(process.env.INSFORGE_DEPLOY_UPLOAD_CONCURRENCY || "", 10);
  const requested = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_UPLOAD_CONCURRENCY;
  return Math.min(requested, MAX_UPLOAD_CONCURRENCY);
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
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
  await withRetry(`upload ${manifestFile.path}`, async () => {
    const response = await fetch(
      API_BASE_URL + "/api/deployments/" + encodeURIComponent(deploymentId) + "/files/" + encodeURIComponent(manifestFile.fileId) + "/content",
      {
        method: "PUT",
        headers: { "x-api-key": await ensureApiKey(), "Content-Type": "application/octet-stream", "Content-Length": String(localFile.size) },
        body: createReadStream(localFile.absolutePath),
        duplex: "half",
        signal: AbortSignal.timeout(120000),
      }
    );
    await readJsonResponse(response);
  });
}

const dryRun = process.argv.includes("--dry-run");

const rootDirectory = process.cwd();
const localFiles = await collectFiles(rootDirectory);
if (localFiles.length === 0) throw new Error("No deployable files found after applying exclusions.");

const envVars = buildEnvVars();

if (dryRun) {
  const totalSize = localFiles.reduce((s, f) => s + f.size, 0);
  console.log("Dry run: no network calls.");
  console.log("File count:", localFiles.length);
  console.log("Total size (bytes):", totalSize);
  console.log("Env vars to forward:", envVars.map((e) => e.key).join(", "));
  process.exit(0);
}

const createResult = await withRetry("create deployment", async () => {
  const key = await ensureApiKey();
  const response = await fetch(API_BASE_URL + "/api/deployments/direct", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ files: localFiles.map(({ path, sha, size }) => ({ path, sha, size })) }),
    signal: AbortSignal.timeout(120000),
  });
  return readJsonResponse(response);
});

if (!createResult || !Array.isArray(createResult.files)) {
  throw new Error("Direct deployment endpoint returned an unexpected response.");
}

const deploymentId = createResult.id;
const localFileByPath = new Map(localFiles.map((file) => [file.path, file]));
const uploadConcurrency = getUploadConcurrency();
console.log("Created deployment. Deployment ID: " + deploymentId);

const failedUploads = [];
await runWithConcurrency(createResult.files, uploadConcurrency, async (manifestFile) => {
  const localFile = localFileByPath.get(manifestFile.path);
  if (!localFile) {
    failedUploads.push(manifestFile.path);
    return;
  }
  if (localFile.sha !== manifestFile.sha || localFile.size !== manifestFile.size) {
    failedUploads.push(manifestFile.path);
    return;
  }
  try {
    await uploadFile(deploymentId, manifestFile, localFile);
  } catch (err) {
    console.error("Failed to upload " + manifestFile.path + ": " + err.message);
    failedUploads.push(manifestFile.path);
  }
});

if (failedUploads.length) {
  console.error("Failed uploads (" + failedUploads.length + "):");
  for (const p of failedUploads) console.error("  " + p);
  process.exit(1);
}

console.log("Deployment files uploaded. Deployment ID: " + deploymentId);
console.log("Uploaded " + createResult.files.length + " files through direct deployment proxy.");
console.log("Starting deployment build...");
const envVars2 = buildEnvVars();
console.log("Forwarding " + envVars2.length + "/" + DEPLOY_ENV_KEYS.length + " env vars: " + envVars2.map((entry) => entry.key).join(", "));
const startResult = await withRetry("start deployment", async () => {
  const key = await ensureApiKey();
  const response = await fetch(API_BASE_URL + "/api/deployments/" + encodeURIComponent(deploymentId) + "/start", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ envVars: envVars2 }),
    signal: AbortSignal.timeout(120000),
  });
  return readJsonResponse(response);
});
console.log("Deployment build started:", JSON.stringify(startResult));
console.log("DEPLOYMENT_ID=" + deploymentId);

// Poll status (best-effort; endpoint not fully verified).
const POLL_INTERVAL_MS = 10000;
const POLL_MAX_MS = 10 * 60 * 1000;
const pollStart = Date.now();
let lastStatus = null;
while (Date.now() - pollStart < POLL_MAX_MS) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  try {
    const status = await api("/api/deployments/" + encodeURIComponent(deploymentId), {}, "status");
    const current = status?.status || status?.state || JSON.stringify(status);
    if (current !== lastStatus) {
      console.log("Status:", current);
      lastStatus = current;
    }
    if (current === "ready" || current === "success" || current === "completed") {
      console.log("Deployment ready.");
      break;
    }
    if (current === "failed" || current === "error") {
      console.error("Build failed:", status?.error || status?.message || "");
      process.exit(1);
    }
  } catch (err) {
    console.warn("Status poll failed (endpoint may differ): " + err.message);
    break;
  }
}
