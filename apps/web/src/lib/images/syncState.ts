import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export type DriveSyncState = Record<string, { etag?: string; modifiedTime?: string }>; 

const STATE_PATH = path.join(os.tmpdir(), 'kylymbii-drive-sync.json');

export const readDriveSyncState = async (): Promise<DriveSyncState> => {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    return JSON.parse(raw) as DriveSyncState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
};

export const writeDriveSyncState = async (state: DriveSyncState) => {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
};

export const buildDriveSyncMarker = (file: { etag?: string; modifiedTime?: string }) =>
  file.etag ?? file.modifiedTime ?? '';
