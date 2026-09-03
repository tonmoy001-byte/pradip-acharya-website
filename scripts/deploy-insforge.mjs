import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE_URL = "https://cpd9mnqf.ap-southeast.insforge.app";
const API_KEY = process.env.INSFORGE_API_KEY;
const DEFAULT_UPLOAD_CONCURRENCY = 8;
const MAX_UPLOAD_CONCURRENCY = 32;
const EXCLUDED_SEGMENTS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.insforge']);

function shouldExcludeDeploymentPath(normalizedName) {
  const segments = normalizedName.split('/');
  if (segments.some((segment) => segment === '.env' || segment.startsWith('.env.'))) return true;
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return true;
  return normalizedName === '.DS_Store' || normalizedName.endsWith('/.DS_Store') || normalizedName.endsWith('.log');
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) {
    const message = data && typeof data === 'object' ? data.message || data.error : null;
    throw new Error(message || 'Request failed with status ' + response.status);
  }
  return data;
}

async function api(pathname, init = {}) {
  const headers = { 'x-api-key': API_KEY, ...(init.headers || {}) };
  const response = await fetch(API_BASE_URL + pathname, { ...init, headers });
  return readJsonResponse(response);
}

function getUploadConcurrency() {
  const parsed = Number.parseInt(process.env.INSFORGE_DEPLOY_UPLOAD_CONCURRENCY || '', 10);
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
  const hash = createHash('sha1');
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    size += chunk.length;
    hash.update(chunk);
  }
  return { sha: hash.digest('hex'), size };
}

async function collectFiles(rootDirectory) {
  const files = [];
  async function walk(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      const normalizedPath = path.relative(rootDirectory, absolutePath).split(path.sep).join('/').replace(/\\/g, '/');
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
    API_BASE_URL + '/api/deployments/' + encodeURIComponent(deploymentId) + '/files/' + encodeURIComponent(manifestFile.fileId) + '/content',
    {
      method: 'PUT',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/octet-stream', 'Content-Length': String(localFile.size) },
      body: createReadStream(localFile.absolutePath),
      duplex: 'half',
    }
  );
  await readJsonResponse(response);
}

const rootDirectory = process.cwd();
const localFiles = await collectFiles(rootDirectory);
if (localFiles.length === 0) throw new Error('No deployable files found.');

const createResult = await api('/api/deployments/direct', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ files: localFiles.map(({ path, sha, size }) => ({ path, sha, size })) }),
});

if (!createResult || !Array.isArray(createResult.files)) throw new Error('Unexpected response.');

const deploymentId = createResult.id;
const localFileByPath = new Map(localFiles.map((file) => [file.path, file]));
const uploadConcurrency = getUploadConcurrency();
console.log('Created deployment. Deployment ID: ' + deploymentId);

await runWithConcurrency(createResult.files, uploadConcurrency, async (manifestFile) => {
  const localFile = localFileByPath.get(manifestFile.path);
  if (!localFile) throw new Error('Unknown file: ' + manifestFile.path);
  if (localFile.sha !== manifestFile.sha || localFile.size !== manifestFile.size) {
    throw new Error('Metadata mismatch for: ' + manifestFile.path);
  }
  await uploadFile(deploymentId, manifestFile, localFile);
});

console.log('Deployment files uploaded. Deployment ID: ' + deploymentId);
console.log('Uploaded ' + createResult.files.length + ' files.');
