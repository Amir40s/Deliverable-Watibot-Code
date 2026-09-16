import path from "path";
import { promises as fs } from "fs";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { prisma, getPrismaClient } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const BACKUP_VERSION = 1;
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const BACKUP_STATE_DIR = path.join(process.cwd(), ".watibot");
const BACKUP_STATE_FILE = path.join(BACKUP_STATE_DIR, "global-backup-status.json");

type TableInfo = { table_name: string };
type ColumnInfo = { column_name: string };
type PrimaryKeyInfo = { table_name: string; column_name: string };
type RawDbClient = Pick<typeof prisma, "$queryRawUnsafe" | "$executeRawUnsafe">;
type ForeignKeyInfo = {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  is_nullable: boolean;
};
type BackupActor = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

export type BackupTable = {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
};

export type BackupMediaFile = {
  path: string;
  size: number;
  mtimeMs: number;
  contentType: string;
  dataBase64: string;
};

export type GlobalBackupFile = {
  app: "watibot";
  type: "global-backup";
  version: number;
  createdAt: string;
  createdBy: {
    id?: string;
    email?: string | null;
    name?: string | null;
  };
  summary: {
    tableCount: number;
    rowCount: number;
    mediaFileCount: number;
    mediaBytes: number;
  };
  database: {
    provider: "postgresql";
    schema: "public";
    primaryKeys: Record<string, string[]>;
    foreignKeys: ForeignKeyInfo[];
    tables: BackupTable[];
  };
  media: {
    root: "public/uploads";
    files: BackupMediaFile[];
  };
};

type BackupFingerprintState = {
  version: number;
  savedAt: string;
  reason: "generated" | "restored" | "checked";
  fingerprint: string;
  summary: GlobalBackupFile["summary"];
  tables: Record<string, { rowCount: number; hash: string }>;
  media: {
    root: "public/uploads";
    hash: string;
    files: Record<string, { size: number; hash: string }>;
  };
};

export type GlobalBackupStatus = {
  hasBackup: boolean;
  isCurrent: boolean;
  message: string;
  checkedAt: string;
  lastBackupAt?: string;
  current: GlobalBackupFile["summary"];
  lastBackup?: GlobalBackupFile["summary"];
  changes: {
    rowDelta: number;
    mediaFileDelta: number;
    mediaBytesDelta: number;
    changedTables: Array<{
      name: string;
      currentRows: number;
      lastRows: number;
      rowDelta: number;
    }>;
    changedMediaFiles: Array<{
      path: string;
      currentSize: number;
      lastSize: number;
      status: "added" | "removed" | "updated";
    }>;
  };
};

export class BackupError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "BackupError";
    this.status = status;
  }
}

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function tableRef(tableName: string) {
  return `${quoteIdent("public")}.${quoteIdent(tableName)}`;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "undefined") return "null";
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

async function assertSuperAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new BackupError("Authentication required", 401);
  }

  if (session.user.role !== "SUPER_ADMIN") {
    throw new BackupError("Only super admins can manage global backups", 403);
  }

  return session.user;
}

async function listPublicTables(client: RawDbClient = prisma) {
  const tables = await client.$queryRawUnsafe<TableInfo[]>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);

  return tables.map((table) => table.table_name);
}

async function listColumns(tableName: string, client: RawDbClient = prisma) {
  const columns = await client.$queryRawUnsafe<ColumnInfo[]>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position ASC
    `,
    tableName,
  );

  return columns.map((column) => column.column_name);
}

async function getPrimaryKeys(client: RawDbClient = prisma) {
  const rows = await client.$queryRawUnsafe<PrimaryKeyInfo[]>(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY tc.table_name ASC, kcu.ordinal_position ASC
  `);

  return rows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.table_name] = acc[row.table_name] || [];
    acc[row.table_name].push(row.column_name);
    return acc;
  }, {});
}

async function getForeignKeys(client: RawDbClient = prisma) {
  return client.$queryRawUnsafe<ForeignKeyInfo[]>(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      (cols.is_nullable = 'YES') AS is_nullable
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.columns cols
      ON cols.table_schema = tc.table_schema
      AND cols.table_name = tc.table_name
      AND cols.column_name = kcu.column_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name ASC, kcu.ordinal_position ASC
  `);
}

async function dumpTable(tableName: string, columns: string[], client: RawDbClient = prisma) {
  const result = await client.$queryRawUnsafe<Array<{ rows: Record<string, unknown>[] }>>(
    `SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS rows FROM ${tableRef(tableName)} AS t`,
  );

  const rows = result[0]?.rows || [];
  return {
    name: tableName,
    columns,
    rows,
    rowCount: rows.length,
  };
}

async function getLiveTableColumns(tableNames: string[], client: RawDbClient = prisma) {
  const entries = await Promise.all(
    tableNames.map(async (tableName) => [tableName, await listColumns(tableName, client)] as const),
  );

  return Object.fromEntries(entries) as Record<string, string[]>;
}

function contentTypeForFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
  };

  return map[ext] || "application/octet-stream";
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  try {
    const entries = await fs.readdir(current, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) return walkFiles(root, entryPath);
        if (entry.isFile()) return [entryPath];
        return [];
      }),
    );

    return files.flat();
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function collectUploadedMedia(): Promise<BackupMediaFile[]> {
  const files = await walkFiles(UPLOADS_DIR);

  return Promise.all(
    files.map(async (filePath) => {
      const stat = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);
      const relativePath = path.relative(UPLOADS_DIR, filePath).split(path.sep).join("/");

      return {
        path: relativePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        contentType: contentTypeForFile(filePath),
        dataBase64: buffer.toString("base64"),
      };
    }),
  );
}

function createBackupSnapshot(
  tables: BackupTable[],
  mediaFiles: BackupMediaFile[],
  reason: BackupFingerprintState["reason"],
): BackupFingerprintState {
  const tableEntries = tables
    .map((table) => {
      const rowHashes = table.rows.map((row) => hashText(stableStringify(row))).sort();
      const tableHash = hashText(
        stableStringify({
          columns: table.columns,
          rows: rowHashes,
        }),
      );

      return [table.name, { rowCount: table.rowCount, hash: tableHash }] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  const mediaEntries = mediaFiles
    .map((file) => [
      file.path,
      {
        size: file.size,
        hash: hashText(file.dataBase64),
      },
    ] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const mediaHash = hashText(stableStringify(Object.fromEntries(mediaEntries)));
  const summary = {
    tableCount: tables.length,
    rowCount: tables.reduce((sum, table) => sum + table.rowCount, 0),
    mediaFileCount: mediaFiles.length,
    mediaBytes: mediaFiles.reduce((sum, file) => sum + file.size, 0),
  };

  const stateWithoutFingerprint = {
    version: BACKUP_VERSION,
    summary,
    tables: Object.fromEntries(tableEntries),
    media: {
      root: "public/uploads" as const,
      hash: mediaHash,
      files: Object.fromEntries(mediaEntries),
    },
  };

  return {
    ...stateWithoutFingerprint,
    savedAt: new Date().toISOString(),
    reason,
    fingerprint: hashText(stableStringify(stateWithoutFingerprint)),
  };
}

async function readBackupState() {
  try {
    const data = await fs.readFile(BACKUP_STATE_FILE, "utf8");
    const parsed = JSON.parse(data) as BackupFingerprintState;

    if (parsed?.version !== BACKUP_VERSION || !parsed.fingerprint || !parsed.summary) {
      return null;
    }

    return parsed;
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeBackupState(state: BackupFingerprintState) {
  await fs.mkdir(BACKUP_STATE_DIR, { recursive: true });
  await fs.writeFile(BACKUP_STATE_FILE, JSON.stringify(state, null, 2));
}

async function createCurrentSnapshot(reason: BackupFingerprintState["reason"]) {
  const tableNames = await listPublicTables();
  const tables: BackupTable[] = [];

  for (const tableName of tableNames) {
    const columns = await listColumns(tableName);
    tables.push(await dumpTable(tableName, columns));
  }

  const mediaFiles = await collectUploadedMedia();
  return createBackupSnapshot(tables, mediaFiles, reason);
}

function compareSnapshots(
  current: BackupFingerprintState,
  lastBackup: BackupFingerprintState | null,
): GlobalBackupStatus {
  if (!lastBackup) {
    return {
      hasBackup: false,
      isCurrent: false,
      message: "No global backup has been generated yet.",
      checkedAt: current.savedAt,
      current: current.summary,
      changes: {
        rowDelta: current.summary.rowCount,
        mediaFileDelta: current.summary.mediaFileCount,
        mediaBytesDelta: current.summary.mediaBytes,
        changedTables: Object.entries(current.tables)
          .filter(([, table]) => table.rowCount > 0)
          .map(([name, table]) => ({
            name,
            currentRows: table.rowCount,
            lastRows: 0,
            rowDelta: table.rowCount,
          })),
        changedMediaFiles: Object.entries(current.media.files).map(([pathName, file]) => ({
          path: pathName,
          currentSize: file.size,
          lastSize: 0,
          status: "added" as const,
        })),
      },
    };
  }

  const tableNames = new Set([...Object.keys(current.tables), ...Object.keys(lastBackup.tables)]);
  const mediaPaths = new Set([...Object.keys(current.media.files), ...Object.keys(lastBackup.media.files)]);
  const changedTables = [...tableNames]
    .sort((a, b) => a.localeCompare(b))
    .filter((tableName) => current.tables[tableName]?.hash !== lastBackup.tables[tableName]?.hash)
    .map((tableName) => {
      const currentRows = current.tables[tableName]?.rowCount || 0;
      const lastRows = lastBackup.tables[tableName]?.rowCount || 0;

      return {
        name: tableName,
        currentRows,
        lastRows,
        rowDelta: currentRows - lastRows,
      };
    });
  const changedMediaFiles = [...mediaPaths]
    .sort((a, b) => a.localeCompare(b))
    .filter((filePath) => {
      const currentFile = current.media.files[filePath];
      const lastFile = lastBackup.media.files[filePath];
      return currentFile?.hash !== lastFile?.hash || currentFile?.size !== lastFile?.size;
    })
    .map((filePath) => {
      const currentFile = current.media.files[filePath];
      const lastFile = lastBackup.media.files[filePath];

      return {
        path: filePath,
        currentSize: currentFile?.size || 0,
        lastSize: lastFile?.size || 0,
        status: !lastFile ? ("added" as const) : !currentFile ? ("removed" as const) : ("updated" as const),
      };
    });
  const isCurrent = current.fingerprint === lastBackup.fingerprint;

  return {
    hasBackup: true,
    isCurrent,
    message: isCurrent ? "Global backup is up to date." : "Changes detected since the last global backup.",
    checkedAt: current.savedAt,
    lastBackupAt: lastBackup.savedAt,
    current: current.summary,
    lastBackup: lastBackup.summary,
    changes: {
      rowDelta: current.summary.rowCount - lastBackup.summary.rowCount,
      mediaFileDelta: current.summary.mediaFileCount - lastBackup.summary.mediaFileCount,
      mediaBytesDelta: current.summary.mediaBytes - lastBackup.summary.mediaBytes,
      changedTables,
      changedMediaFiles,
    },
  };
}

function buildRequiredTableOrder(tableNames: string[], foreignKeys: ForeignKeyInfo[]) {
  const tableSet = new Set(tableNames);
  const incomingCount = new Map(tableNames.map((table) => [table, 0]));
  const outgoing = new Map<string, Set<string>>();

  tableNames.forEach((table) => outgoing.set(table, new Set()));

  foreignKeys
    .filter((fk) => !fk.is_nullable)
    .filter((fk) => tableSet.has(fk.table_name) && tableSet.has(fk.foreign_table_name))
    .filter((fk) => fk.table_name !== fk.foreign_table_name)
    .forEach((fk) => {
      const children = outgoing.get(fk.foreign_table_name);
      if (!children?.has(fk.table_name)) {
        children?.add(fk.table_name);
        incomingCount.set(fk.table_name, (incomingCount.get(fk.table_name) || 0) + 1);
      }
    });

  const queue = tableNames.filter((table) => (incomingCount.get(table) || 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const table = queue.shift()!;
    ordered.push(table);

    for (const child of outgoing.get(table) || []) {
      const nextCount = (incomingCount.get(child) || 0) - 1;
      incomingCount.set(child, nextCount);
      if (nextCount === 0) queue.push(child);
    }
  }

  if (ordered.length !== tableNames.length) {
    const blocked = tableNames.filter((table) => !ordered.includes(table));
    throw new BackupError(
      `Restore blocked by required circular foreign keys between: ${blocked.join(", ")}`,
      400,
    );
  }

  return ordered;
}

function getNullableForeignKeyColumns(foreignKeys: ForeignKeyInfo[]) {
  return foreignKeys.reduce<Record<string, Set<string>>>((acc, fk) => {
    if (!fk.is_nullable) return acc;
    acc[fk.table_name] = acc[fk.table_name] || new Set<string>();
    acc[fk.table_name].add(fk.column_name);
    return acc;
  }, {});
}

function nullOptionalForeignKeys(
  rows: Record<string, unknown>[],
  nullableColumns: Set<string> | undefined,
) {
  if (!nullableColumns?.size) return rows;

  return rows.map((row) => {
    const nextRow = { ...row };
    nullableColumns.forEach((column) => {
      if (column in nextRow) nextRow[column] = null;
    });
    return nextRow;
  });
}

async function insertRows(
  client: RawDbClient,
  table: BackupTable,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0 || table.columns.length === 0) return;

  const columns = table.columns.map(quoteIdent).join(", ");
  const selectColumns = table.columns.map(quoteIdent).join(", ");
  const sql = `
    INSERT INTO ${tableRef(table.name)} (${columns})
    SELECT ${selectColumns}
    FROM jsonb_populate_recordset(NULL::${tableRef(table.name)}, $1::jsonb)
  `;

  await client.$executeRawUnsafe(sql, JSON.stringify(rows));
}

async function restoreOptionalForeignKeys(
  client: RawDbClient,
  table: BackupTable,
  primaryKeys: Record<string, string[]>,
  nullableColumns: Set<string> | undefined,
) {
  if (!nullableColumns?.size) return;

  const pkColumns = primaryKeys[table.name] || [];
  if (pkColumns.length === 0) return;

  const updateColumns = [...nullableColumns].filter((column) => table.columns.includes(column));
  if (updateColumns.length === 0) return;

  const setClause = updateColumns.map((col) => `${quoteIdent(col)} = s.${quoteIdent(col)}`).join(", ");
  const whereClause = pkColumns.map((col) => `t.${quoteIdent(col)} = s.${quoteIdent(col)}`).join(" AND ");

  const sql = `
    UPDATE ${tableRef(table.name)} AS t
    SET ${setClause}
    FROM jsonb_populate_recordset(NULL::${tableRef(table.name)}, $1::jsonb) AS s
    WHERE ${whereClause}
  `;

  await client.$executeRawUnsafe(sql, JSON.stringify(table.rows));
}

function validateBackupShape(input: unknown): GlobalBackupFile {
  const backup = input as GlobalBackupFile;

  if (!backup || backup.app !== "watibot" || backup.type !== "global-backup") {
    throw new BackupError("This is not a valid WatiBot global backup file", 400);
  }

  if (backup.version !== BACKUP_VERSION) {
    throw new BackupError(`Unsupported backup version: ${backup.version}`, 400);
  }

  if (!Array.isArray(backup.database?.tables)) {
    throw new BackupError("Backup file is missing database tables", 400);
  }

  for (const table of backup.database.tables) {
    if (!table?.name || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      throw new BackupError("Backup file contains an invalid database table payload", 400);
    }
  }

  if (!Array.isArray(backup.media?.files)) {
    throw new BackupError("Backup file is missing media metadata", 400);
  }

  return backup;
}

function validateSameSchema(
  backupTables: BackupTable[],
  liveTables: string[],
  liveColumnsByTable: Record<string, string[]>,
) {
  const backupSet = new Set(backupTables.map((table) => table.name));
  const liveSet = new Set(liveTables);
  const missing = liveTables.filter((table) => !backupSet.has(table));
  const unknown = backupTables.map((table) => table.name).filter((table) => !liveSet.has(table));

  if (missing.length || unknown.length) {
    console.warn(
      [
        "Backup schema differences detected (ignoring gracefully).",
        missing.length ? `Missing tables: ${missing.join(", ")}` : "",
        unknown.length ? `Unknown tables: ${unknown.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  for (const backupTable of backupTables) {
    const liveColumns = liveColumnsByTable[backupTable.name] || [];
    const backupColumnSet = new Set(backupTable.columns);
    const liveColumnSet = new Set(liveColumns);
    const missingColumns = liveColumns.filter((column) => !backupColumnSet.has(column));
    const unknownColumns = backupTable.columns.filter((column) => !liveColumnSet.has(column));

    if (missingColumns.length || unknownColumns.length) {
      console.warn(
        [
          `Backup columns differences detected for ${backupTable.name}.`,
          missingColumns.length ? `Missing columns: ${missingColumns.join(", ")}` : "",
          unknownColumns.length ? `Unknown columns (will be skipped): ${unknownColumns.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      // Remove unknown columns so the INSERT statement doesn't break
      if (unknownColumns.length > 0) {
        backupTable.columns = backupTable.columns.filter((column) => !unknownColumns.includes(column));
      }
    }
  }
}

function safeMediaPath(relativePath: string) {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (path.isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new BackupError(`Unsafe media path in backup: ${relativePath}`, 400);
  }
  return path.join(UPLOADS_DIR, normalized);
}

async function restoreMedia(files: BackupMediaFile[]) {
  await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  for (const file of files) {
    const targetPath = safeMediaPath(file.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, Buffer.from(file.dataBase64, "base64"));
    if (file.mtimeMs) {
      const mtime = new Date(file.mtimeMs);
      await fs.utimes(targetPath, mtime, mtime).catch(() => undefined);
    }
  }
}

async function buildGlobalBackup(user: BackupActor, targetDb: 'neon' | 'contabo' = 'neon') {
  const client = getPrismaClient(targetDb);
  const tableNames = await listPublicTables(client);
  const primaryKeys = await getPrimaryKeys(client);
  const foreignKeys = await getForeignKeys(client);
  const tables: BackupTable[] = [];

  for (const tableName of tableNames) {
    const columns = await listColumns(tableName, client);
    tables.push(await dumpTable(tableName, columns, client));
  }

  const mediaFiles = await collectUploadedMedia();
  const rowCount = tables.reduce((sum, table) => sum + table.rowCount, 0);
  const mediaBytes = mediaFiles.reduce((sum, file) => sum + file.size, 0);

  return {
    app: "watibot",
    type: "global-backup",
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    createdBy: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    summary: {
      tableCount: tables.length,
      rowCount,
      mediaFileCount: mediaFiles.length,
      mediaBytes,
    },
    database: {
      provider: "postgresql",
      schema: "public",
      primaryKeys,
      foreignKeys,
      tables,
    },
    media: {
      root: "public/uploads",
      files: mediaFiles,
    },
  } satisfies GlobalBackupFile;
}

export async function createGlobalBackup(targetDb: 'neon' | 'contabo' = 'neon') {
  const user = await assertSuperAdmin();
  const backup = await buildGlobalBackup(user, targetDb);

  await prisma.systemAuditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "Generated Backup",
      module: "Global Backup",
      details: `Generated global backup from ${targetDb === 'contabo' ? 'Contabo' : 'Neon'} with ${backup.summary.tableCount} tables and ${backup.summary.mediaFileCount} media files.`,
    },
  });

  return backup;
}

export async function createGlobalBackupForUser(user: BackupActor, targetDb: 'neon' | 'contabo' = 'neon') {
  return buildGlobalBackup(user, targetDb);
}

export async function rememberGlobalBackupSnapshot(
  backup: GlobalBackupFile,
  reason: BackupFingerprintState["reason"] = "generated",
) {
  const snapshot = createBackupSnapshot(backup.database.tables, backup.media.files, reason);
  await writeBackupState(snapshot);
  return snapshot;
}

export async function getGlobalBackupStatus() {
  await assertSuperAdmin();
  const [currentSnapshot, lastBackupSnapshot] = await Promise.all([
    createCurrentSnapshot("checked"),
    readBackupState(),
  ]);

  return compareSnapshots(currentSnapshot, lastBackupSnapshot);
}

function sanitizeOrphanedRows(tables: BackupTable[], foreignKeys: ForeignKeyInfo[]) {
  const tableMap = new Map(tables.map((table) => [table.name, table]));

  // Pre-calculate primary/foreign key sets for each table in the backup
  const tableKeySets = new Map<string, Record<string, Set<unknown>>>();
  for (const table of tables) {
    const keySets: Record<string, Set<unknown>> = {};
    tableKeySets.set(table.name, keySets);

    const referencedColumns = new Set(
      foreignKeys
        .filter((fk) => fk.foreign_table_name === table.name)
        .map((fk) => fk.foreign_column_name)
    );

    for (const col of referencedColumns) {
      keySets[col] = new Set(
        table.rows
          .map((row) => row[col])
          .filter((val) => val !== null && val !== undefined)
      );
    }
  }

  // Filter/nullify the rows for each table to avoid foreign key violations
  for (const table of tables) {
    const fks = foreignKeys.filter((fk) => fk.table_name === table.name);
    if (fks.length === 0) continue;

    const originalLength = table.rows.length;
    let filteredRows = [...table.rows];

    for (const fk of fks) {
      const parentKeySets = tableKeySets.get(fk.foreign_table_name);
      if (!parentKeySets) continue; // Parent table is not in the backup

      const validValues = parentKeySets[fk.foreign_column_name];
      if (!validValues) continue;

      if (fk.is_nullable) {
        // Nullify orphans
        filteredRows = filteredRows.map((row) => {
          const val = row[fk.column_name];
          if (val !== null && val !== undefined && !validValues.has(val)) {
            return { ...row, [fk.column_name]: null };
          }
          return row;
        });
      } else {
        // Filter out orphans
        filteredRows = filteredRows.filter((row) => {
          const val = row[fk.column_name];
          return val === null || val === undefined || validValues.has(val);
        });
      }
    }

    if (filteredRows.length !== originalLength) {
      console.warn(
        `[RESTORE] Sanitized ${originalLength - filteredRows.length} orphaned rows from table ${table.name} due to foreign key constraints.`
      );
      table.rows = filteredRows;
      table.rowCount = filteredRows.length;
    }
  }
}

export async function restoreGlobalBackup(input: unknown, targetDb: 'neon' | 'contabo' = 'neon') {
  const user = await assertSuperAdmin();
  const dbClient = getPrismaClient(targetDb);
  const backup = validateBackupShape(input);
  const liveTables = await listPublicTables(dbClient);
  const liveColumnsByTable = await getLiveTableColumns(liveTables, dbClient);
  validateSameSchema(backup.database.tables, liveTables, liveColumnsByTable);

  const foreignKeys = await getForeignKeys(dbClient);
  sanitizeOrphanedRows(backup.database.tables, foreignKeys);

  const tableMap = new Map(backup.database.tables.map((table) => [table.name, table]));
  const primaryKeys = await getPrimaryKeys(dbClient);
  const nullableForeignKeyColumns = getNullableForeignKeyColumns(foreignKeys);
  const orderedTableNames = buildRequiredTableOrder(liveTables, foreignKeys);

  await (dbClient as any).$transaction(
    async (tx: any) => {
      const truncateTables = liveTables.map(tableRef).join(", ");
      if (truncateTables) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${truncateTables} RESTART IDENTITY CASCADE`);
      }

      for (const tableName of orderedTableNames) {
        const table = tableMap.get(tableName);
        if (!table) continue;

        const initialRows = nullOptionalForeignKeys(table.rows, nullableForeignKeyColumns[table.name]);
        await insertRows(tx as RawDbClient, table, initialRows);
      }

      for (const tableName of orderedTableNames) {
        const table = tableMap.get(tableName);
        if (!table) continue;

        await restoreOptionalForeignKeys(
          tx as RawDbClient,
          table,
          primaryKeys,
          nullableForeignKeyColumns[table.name],
        );
      }
    },
    { timeout: 600_000, maxWait: 30_000 },
  );

  await restoreMedia(backup.media.files);
  await rememberGlobalBackupSnapshot(backup, "restored");

  await prisma.systemAuditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "Restored Backup",
      module: "Global Backup",
      details: `Restored global backup into ${targetDb === 'contabo' ? 'Contabo' : 'Neon'} from ${backup.createdAt}. Restored ${backup.summary.rowCount} rows from ${backup.summary.tableCount} tables.`,
    },
  });

  return {
    restoredAt: new Date().toISOString(),
    tableCount: backup.summary.tableCount,
    rowCount: backup.summary.rowCount,
    mediaFileCount: backup.summary.mediaFileCount,
    targetDb,
  };
}

export async function emptyDatabase() {
  const user = await assertSuperAdmin();
  const liveTables = await listPublicTables();

  await prisma.$transaction(
    async (tx) => {
      const truncateTables = liveTables.map(tableRef).join(", ");
      if (truncateTables) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${truncateTables} RESTART IDENTITY CASCADE`);
      }
    },
    { timeout: 300_000, maxWait: 10_000 },
  );

  await prisma.systemAuditLog.create({
    data: {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      action: "Emptied Database",
      module: "Global Backup",
      details: `Emptied all ${liveTables.length} tables in the database via factory reset.`,
    },
  });

  return { success: true, tableCount: liveTables.length };
}
