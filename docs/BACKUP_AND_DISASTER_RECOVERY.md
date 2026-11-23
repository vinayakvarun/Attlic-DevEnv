# attlic - Backup & Disaster Recovery Runbook

## 1. Overview
attlic employs a multi-tier persistence model:
1. **Cloud Firestore**: High-availability cloud-managed persistence for production collections (`users`, `organizations`, `organizationMembers`, `assessments`, `attempts`).
2. **Disk-Backed State**: Fast disk snapshot layer in `data/assessments.json` and `data/attempts.json`.
3. **Automated Point-in-Time Snapshots**: Scripted snapshots in `data/backups/snapshot_<TIMESTAMP>` accompanied by SHA256 cryptographic manifests.

---

## 2. Automated Backup Execution
To create a complete point-in-time database snapshot:
```bash
npx tsx scripts/backup.ts
```
### What it does:
- Copies `assessments.json` and `attempts.json` into a versioned snapshot folder: `data/backups/snapshot_YYYY-MM-DDTHH-mm-ss-SSSZ/`.
- Computes SHA256 cryptographic hashes for every file.
- Records record counts and byte sizes into `manifest.json`.

---

## 3. Database Restoration Execution
To restore the platform to a verified snapshot state:
```bash
# Restore latest snapshot automatically:
npx tsx scripts/restore.ts

# Or restore a specific historical snapshot:
npx tsx scripts/restore.ts snapshot_2026-11-06T14-52-55-822Z
```
### What it does:
- Reads the snapshot's `manifest.json`.
- Verifies SHA256 checksums to guarantee zero bit-rot or file corruption before applying changes.
- Atomically restores `assessments.json` and `attempts.json` to the active storage directory.

---

## 4. Firestore Cloud Backup & Point-In-Time Recovery (PITR)
For Google Cloud Firestore:
1. **Enable Firestore PITR**:
   ```bash
   gcloud firestore databases update --database=ai-studio-398d1008-1eb6-448a-908f-12937fcc37fc --enable-pitr
   ```
2. **Export to Cloud Storage Bucket**:
   ```bash
   gcloud firestore export gs://<BACKUP_BUCKET>/attlic-backups/$(date +%Y-%m-%d)
   ```
3. **Import from Cloud Storage**:
   ```bash
   gcloud firestore import gs://<BACKUP_BUCKET>/attlic-backups/2026-11-06
   ```

---

## 5. Disaster Recovery (DR) Checklist
- [x] Automated backup script created and verified (`scripts/backup.ts`).
- [x] Automated restore script with SHA256 verification created and tested (`scripts/restore.ts`).
- [x] Firestore security rules deployed and verified (`firestore.rules`).
- [x] Clean failover from Cloud Firestore to disk persistence if network is degraded.
- [x] Zero loss of active candidate examination answers via client-side `localStorage` autosave.
