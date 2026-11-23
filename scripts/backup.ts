/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Point-In-Time Backup & Disaster Recovery Automation
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

export function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(BACKUPS_DIR, `snapshot_${timestamp}`);

  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  const filesToBackup = ['assessments.json', 'attempts.json'];
  const manifest: {
    timestamp: string;
    files: { name: string; sizeBytes: number; sha256: string; recordCount: number }[];
  } = {
    timestamp: new Date().toISOString(),
    files: [],
  };

  for (const filename of filesToBackup) {
    const sourcePath = path.join(DATA_DIR, filename);
    const destPath = path.join(backupFolder, filename);

    if (fs.existsSync(sourcePath)) {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      fs.writeFileSync(destPath, content, 'utf-8');

      let recordCount = 0;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) recordCount = parsed.length;
      } catch {}

      manifest.files.push({
        name: filename,
        sizeBytes: Buffer.byteLength(content),
        sha256: generateChecksum(content),
        recordCount,
      });
    }
  }

  // Write manifest
  fs.writeFileSync(path.join(backupFolder, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`✓ Backup successfully created at: ${backupFolder}`);
  console.log('Manifest:', JSON.stringify(manifest, null, 2));
  return backupFolder;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  performBackup();
}
