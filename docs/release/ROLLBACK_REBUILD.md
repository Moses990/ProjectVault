# Project Vault V1 Rollback And Rebuild

Status: V1 Final procedure

## Data Boundary

`project.json` and project folders are the source of truth. SQLite is a rebuildable index cache. Rollback and rebuild procedures must not delete, move, or rewrite user project files.

## Backup

Create a SQLite backup before risky maintenance:

1. Open Settings.
2. Run Create Backup.
3. Confirm that a backup name is returned.

Backend backups use SQLite backup APIs after checkpointing WAL state. RC validation restored a `91,594,752` byte backup from the 100k fixture. Local installed usage validation also passed backup and restore entry-point checks against the packaged app.

## Restore

Restore only the SQLite cache:

1. Stop active scans.
2. Choose the backup name.
3. Confirm restore.
4. Restart backend if needed.
5. Run search or project list checks.

Restore does not modify project folders or `project.json`.

## Rebuild Index

Use rebuild when search or cached index data is stale:

```powershell
POST /api/v1/scanner/rebuild?confirm=true
```

Expected behavior:

- Clear and rebuild SQLite FTS rows.
- Preserve settings and provider configuration.
- Keep project business files untouched.

## Full Rescan

Use a project rescan when project file metadata appears stale:

```powershell
POST /api/v1/scanner/scan
```

Manual rescan performs full reconciliation for the selected project. For known file-system events, the scanner supports a changed-path fast path through `scan_project_incremental(..., changed_paths=[...])`.

## Failure Handling

If restore fails:

1. Keep the original backup file.
2. Stop the backend process.
3. Remove only SQLite cache files if needed: `project_vault.db`, `project_vault.db-wal`, `project_vault.db-shm`.
4. Reinitialize the database.
5. Run full scan from the configured project root.

Never delete project source folders as part of SQLite cache recovery.
