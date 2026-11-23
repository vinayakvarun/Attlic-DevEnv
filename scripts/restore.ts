/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Point-In-Time Restoration Engine
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function generateChecksum(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function restoreFromSnapshot(snapshotFolderName?: string) {
  if (!fs.existsSync(BACKUPS_DIR)) {
    throw new Error(`Backups directory does not exist: ${BACKUPS_DIR}`);
  }

  let targetFolder = snapshotFolderName;
  if (!targetFolder) {
    // Find latest snapshot
    const entries = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('snapshot_')).sort().reverse();
    if (entries.length === 0) {
      throw new Error('No backup snapshots found in data/backups.');
    }
    targetFolder = entries[0];
  }

  const snapshotPath = path.join(BACKUPS_DIR, targetFolder);
  const manifestPath = path.join(snapshotPath, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest missing in snapshot: ${snapshotPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`--- Restoring database from snapshot: ${targetFolder} (Timestamp: ${manifest.timestamp}) ---`);

  for (const fileInfo of manifest.files) {
    const sourcePath = path.join(snapshotPath, fileInfo.name);
    const destPath = path.join(DATA_DIR, fileInfo.name);

    if (fs.existsSync(sourcePath)) {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const hash = generateChecksum(content);

      if (hash !== fileInfo.sha256) {
        throw new Error(`Checksum mismatch for ${fileInfo.name}! Expected ${fileInfo.sha256}, got ${hash}`);
      }

      fs.writeFileSync(destPath, content, 'utf-8');
      console.log(`✓ Restored ${fileInfo.name} (${fileInfo.recordCount} records, ${fileInfo.sizeBytes} bytes) - Verified SHA256.`);
    }
  }

  console.log('✓ Point-in-time database restoration completed successfully.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  restoreFromSnapshot(arg);
}
