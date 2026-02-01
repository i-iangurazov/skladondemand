import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

let didLoad = false;

const findWorkspaceRoot = () => {
  let current = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
};

const applyEnvLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const equalsIndex = cleaned.indexOf('=');
  if (equalsIndex === -1) return;
  const key = cleaned.slice(0, equalsIndex).trim();
  if (!key || process.env[key]) return;
  let value = cleaned.slice(equalsIndex + 1).trim();
  const hasQuotes =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  if (hasQuotes) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
};

const loadEnvFile = (filePath: string) => {
  try {
    const contents = fs.readFileSync(filePath, 'utf8');
    contents.split(/\r?\n/).forEach(applyEnvLine);
  } catch {
    // ignore unreadable env files
  }
};

export const ensureServerEnv = () => {
  if (didLoad) return;
  didLoad = true;
  const root = findWorkspaceRoot();
  ['.env.local', '.env'].forEach((filename) => {
    const envPath = path.join(root, filename);
    if (fs.existsSync(envPath)) {
      loadEnvFile(envPath);
    }
  });
};
