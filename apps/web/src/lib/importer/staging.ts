import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createHash, randomUUID } from 'crypto';
import type { ImportStaging } from './types';

const IMPORT_DIR = path.join(os.tmpdir(), 'kylymbii-imports');

export const ensureImportDir = async () => {
  await fs.mkdir(IMPORT_DIR, { recursive: true });
};

export const createImportId = () => randomUUID();

export const checksumBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex');

export const getImportFilePath = (importId: string) => path.join(IMPORT_DIR, `import-${importId}.json`);

export const writeImportStaging = async (data: ImportStaging) => {
  await ensureImportDir();
  const filePath = getImportFilePath(data.importId);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
};

export const readImportStaging = async (importId: string) => {
  const filePath = getImportFilePath(importId);
  const payload = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(payload) as ImportStaging;
};
