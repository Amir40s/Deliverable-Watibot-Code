import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, getSecondaryPrisma } from "@/lib/prisma";
import v8 from "v8";
import os from "os";
import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";

export const dynamic = "force-dynamic";

/**
 * Measure event loop lag (in milliseconds)
 */
async function measureEventLoopLag(): Promise<number> {
  const start = performance.now();
  return new Promise((resolve) => {
    setImmediate(() => {
      const lag = performance.now() - start;
      resolve(Math.round(lag * 100) / 100);
    });
  });
}

/**
 * Safely read the tail (last N lines) of a log file without loading whole file into memory.
 */
function readLogTail(filePath: string, maxLines = 100, maxBytes = 150 * 1024): { lines: string[]; totalLines: number; fileSize: number } {
  if (!fs.existsSync(filePath)) {
    return { lines: [], totalLines: 0, fileSize: 0 };
  }

  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    if (fileSize === 0) return { lines: [], totalLines: 0, fileSize: 0 };

    const bytesToRead = Math.min(fileSize, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(filePath, "r");

    try {
      fs.readSync(fd, buffer, 0, bytesToRead, fileSize - bytesToRead);
    } finally {
      fs.closeSync(fd);
    }

    const content = buffer.toString("utf-8");
    const allLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const tailLines = allLines.slice(-maxLines);

    // Approximate total line count from average line length if file is huge
    let estimatedTotalLines = allLines.length;
    if (fileSize > maxBytes && allLines.length > 0) {
      const avgLineLength = bytesToRead / allLines.length;
      estimatedTotalLines = Math.round(fileSize / avgLineLength);
    }

    return {
      lines: tailLines,
      totalLines: estimatedTotalLines,
      fileSize,
    };
  } catch (err) {
    console.error("[SystemStatus] Error reading log tail:", err);
    return { lines: [`Error reading log file: ${(err as Error).message}`], totalLines: 0, fileSize: 0 };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Memory Metrics
    const memoryUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const heapSpaces = v8.getHeapSpaceStatistics();

    // 2. Event loop delay & Active libuv handles
    const eventLoopLag = await measureEventLoopLag();
    const activeHandles = typeof (process as any)._getActiveHandles === "function" 
      ? (process as any)._getActiveHandles().length 
      : null;
    const activeRequests = typeof (process as any)._getActiveRequests === "function" 
      ? (process as any)._getActiveRequests().length 
      : null;

    // 3. Host / OS Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    const cpuUsage = process.cpuUsage();

    // 4. Primary Database (Neon / Postgres) Ping & Pool
    let primaryDbStatus = "unknown";
    let primaryDbLatency = -1;
    let poolStats = { total: 0, idle: 0, waiting: 0 };

    try {
      const dbStart = performance.now();
      await prisma.$queryRaw`SELECT 1`;
      primaryDbLatency = Math.round(performance.now() - dbStart);
      primaryDbStatus = primaryDbLatency < 200 ? "healthy" : primaryDbLatency < 1000 ? "degraded" : "critical";
    } catch (err) {
      primaryDbStatus = "error";
    }

    // Check pool from globalForPrisma
    const pool = (global as any).pool;
    if (pool) {
      poolStats = {
        total: pool.totalCount ?? 0,
        idle: pool.idleCount ?? 0,
        waiting: pool.waitingCount ?? 0,
      };
    }

    // 5. Secondary Database (Contabo) Ping
    let secondaryDbStatus = "disabled";
    let secondaryDbLatency = -1;
    const secondaryPrisma = getSecondaryPrisma();
    if (secondaryPrisma) {
      try {
        const secStart = performance.now();
        await secondaryPrisma.$queryRaw`SELECT 1`;
        secondaryDbLatency = Math.round(performance.now() - secStart);
        secondaryDbStatus = "healthy";
      } catch (err) {
        secondaryDbStatus = "error";
      }
    }

    // 6. WhatsApp Baileys Sockets Status
    const baileysSockets: Map<string, any> = (globalThis as any).__wati_baileys_sockets || new Map();
    const pendingSessions: Map<string, string> = (globalThis as any).__wati_baileys_pending_sessions || new Map();
    const reconnectAttempts: Map<string, any> = (globalThis as any).__wati_baileys_reconnect_attempts || new Map();

    const activeSocketOrgs: string[] = [];
    for (const [orgId] of baileysSockets.entries()) {
      activeSocketOrgs.push(orgId);
    }

    // 7. Background Campaign Worker
    const campaignWorkerStarted = !!(globalThis as any).__watibot_campaign_worker_started;

    // 8. Error Log File Stats
    const logFilePath = path.join(process.cwd(), "watibot-error.log");
    const logData = readLogTail(logFilePath, 100);

    // Format human readable helpers
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return "0 MB";
      const mb = bytes / (1024 * 1024);
      if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`;
      }
      return `${mb.toFixed(1)} MB`;
    };

    // Calculate Health Score / 504 Timeout Risk
    // 504 occurs when event loop lag is huge (> 200ms), heap is > 85%, or DB is timing out
    const heapPercentage = Math.round((heapStats.used_heap_size / heapStats.heap_size_limit) * 100);
    const hostRamPercentage = Math.round((usedMem / totalMem) * 100);

    let healthStatus: "healthy" | "warning" | "critical" = "healthy";
    const riskFactors: string[] = [];

    if (eventLoopLag > 200) {
      healthStatus = "critical";
      riskFactors.push(`Critical Event Loop Lag (${eventLoopLag}ms) - Node is freezing, direct 504 Timeout risk!`);
    } else if (eventLoopLag > 50) {
      healthStatus = "warning";
      riskFactors.push(`Elevated Event Loop Delay (${eventLoopLag}ms)`);
    }

    if (heapPercentage > 85) {
      healthStatus = "critical";
      riskFactors.push(`Heap Memory near limit (${heapPercentage}%) - GC thrashing likely causing 504 Timeouts!`);
    } else if (heapPercentage > 70) {
      if (healthStatus !== "critical") healthStatus = "warning";
      riskFactors.push(`High Heap Memory (${heapPercentage}%)`);
    }

    if (primaryDbLatency > 1500 || primaryDbStatus === "error") {
      healthStatus = "critical";
      riskFactors.push(`Primary Database unresponsive or slow (${primaryDbLatency}ms)`);
    }

    if (logData.fileSize > 10 * 1024 * 1024) {
      if (healthStatus === "healthy") healthStatus = "warning";
      riskFactors.push(`Error log file is oversized (${formatBytes(logData.fileSize)}) - causing disk I/O contention.`);
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health: {
        status: healthStatus,
        heapPercentage,
        hostRamPercentage,
        eventLoopLagMs: eventLoopLag,
        riskFactors,
        isGcAvailable: typeof (global as any).gc === "function",
      },
      nodeProcess: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        activeHandles,
        activeRequests,
        cpuUsage: {
          userMs: Math.round(cpuUsage.user / 1000),
          systemMs: Math.round(cpuUsage.system / 1000),
        },
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapUsedFormatted: formatBytes(memoryUsage.heapUsed),
        heapTotal: memoryUsage.heapTotal,
        heapTotalFormatted: formatBytes(memoryUsage.heapTotal),
        heapLimit: heapStats.heap_size_limit,
        heapLimitFormatted: formatBytes(heapStats.heap_size_limit),
        heapHeadroom: heapStats.heap_size_limit - memoryUsage.heapUsed,
        heapHeadroomFormatted: formatBytes(heapStats.heap_size_limit - memoryUsage.heapUsed),
        rss: memoryUsage.rss,
        rssFormatted: formatBytes(memoryUsage.rss),
        external: memoryUsage.external,
        externalFormatted: formatBytes(memoryUsage.external),
        arrayBuffers: memoryUsage.arrayBuffers,
        arrayBuffersFormatted: formatBytes(memoryUsage.arrayBuffers),
        detachedContexts: heapStats.number_of_detached_contexts,
        nativeContexts: heapStats.number_of_native_contexts,
        spaces: heapSpaces.map((s) => ({
          name: s.space_name,
          sizeFormatted: formatBytes(s.space_size),
          usedFormatted: formatBytes(s.space_used_size),
          availableFormatted: formatBytes(s.space_available_size),
        })),
      },
      os: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        totalMem,
        totalMemFormatted: formatBytes(totalMem),
        freeMem,
        freeMemFormatted: formatBytes(freeMem),
        usedMem,
        usedMemFormatted: formatBytes(usedMem),
        uptimeSeconds: Math.floor(os.uptime()),
        uptimeFormatted: formatUptime(os.uptime()),
        loadAvg: loadAvg.map((l) => Math.round(l * 100) / 100),
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || "Unknown",
        cpuSpeedMhz: cpus[0]?.speed || 0,
      },
      database: {
        primary: {
          status: primaryDbStatus,
          latencyMs: primaryDbLatency,
          pool: poolStats,
        },
        secondary: {
          status: secondaryDbStatus,
          latencyMs: secondaryDbLatency,
        },
        dualDbWriteEnabled: process.env.DUAL_DB_WRITE === "true" || process.env.DUAL_DB_WRITE === "1",
      },
      whatsapp: {
        activeSocketsCount: baileysSockets.size,
        activeOrgIds: activeSocketOrgs,
        pendingSessionsCount: pendingSessions.size,
        reconnectAttemptsCount: reconnectAttempts.size,
        campaignWorkerRunning: campaignWorkerStarted,
      },
      logs: {
        exists: fs.existsSync(logFilePath),
        sizeBytes: logData.fileSize,
        sizeFormatted: formatBytes(logData.fileSize),
        estimatedTotalLines: logData.totalLines,
        tailLines: logData.lines,
      },
    });
  } catch (error: any) {
    console.error("[SystemStatus] Error generating diagnostics:", error);
    return NextResponse.json(
      { error: "Failed to generate diagnostics", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * Maintenance Actions:
 * - Trigger GC
 * - Clear Stale WhatsApp Sockets
 * - Truncate / Rotate watibot-error.log
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "gc") {
      if (typeof (global as any).gc === "function") {
        const before = process.memoryUsage();
        (global as any).gc();
        const after = process.memoryUsage();
        const freedBytes = before.heapUsed - after.heapUsed;
        const freedMb = (freedBytes / (1024 * 1024)).toFixed(2);
        return NextResponse.json({
          success: true,
          message: `Garbage Collection completed! Freed ${freedMb} MB of heap memory.`,
          freedBytes,
        });
      } else {
        return NextResponse.json({
          success: false,
          message:
            "Manual Garbage Collection is not enabled on this Node instance. To enable it, start Node with the --expose-gc flag (e.g. cross-env NODE_OPTIONS='--expose-gc' next start).",
        });
      }
    }

    if (action === "clear-sockets") {
      const baileysSockets: Map<string, any> = (globalThis as any).__wati_baileys_sockets;
      let terminatedCount = 0;
      if (baileysSockets) {
        for (const [orgId, sock] of baileysSockets.entries()) {
          try {
            sock.ev?.removeAllListeners();
            sock.end?.(undefined);
            terminatedCount++;
          } catch (e) {
            // Ignore socket termination error
          }
        }
        baileysSockets.clear();
      }

      const pendingSessions: Map<string, string> = (globalThis as any).__wati_baileys_pending_sessions;
      if (pendingSessions) pendingSessions.clear();

      const reconnectAttempts: Map<string, any> = (globalThis as any).__wati_baileys_reconnect_attempts;
      if (reconnectAttempts) reconnectAttempts.clear();

      return NextResponse.json({
        success: true,
        message: `Cleared and reset ${terminatedCount} active WhatsApp socket connection(s).`,
      });
    }

    if (action === "truncate-log") {
      const logFilePath = path.join(process.cwd(), "watibot-error.log");
      if (fs.existsSync(logFilePath)) {
        const stats = fs.statSync(logFilePath);
        const originalSizeMb = (stats.size / (1024 * 1024)).toFixed(2);

        // Backup last 100KB to .bak before truncating
        try {
          const bakPath = path.join(process.cwd(), "watibot-error.log.bak");
          fs.copyFileSync(logFilePath, bakPath);
        } catch (e) {
          // ignore backup fail
        }

        fs.writeFileSync(logFilePath, `[${new Date().toISOString()}] Log truncated by Admin. Previous size: ${originalSizeMb} MB\n`);

        return NextResponse.json({
          success: true,
          message: `Truncated error log from ${originalSizeMb} MB to 0 MB. Backed up to watibot-error.log.bak.`,
        });
      }
      return NextResponse.json({ success: true, message: "Log file does not exist or is already empty." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Action failed" }, { status: 500 });
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
