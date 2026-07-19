import type { FastifyPluginAsync } from "fastify";
import { requireApiKey, requireJwtAuth } from "../auth/middleware.js";
import { getPrisma } from "../persistence/prisma.js";
import { logger } from "../logging/logger.js";
import { queryAuditLogs, generateComplianceReport } from "../audit/audit-logger.js";

export const monitoringRoutes: FastifyPluginAsync = async (app) => {
  // System metrics endpoint
  app.get("/metrics/system", { preHandler: requireApiKey }, async () => {
    const os = await import("os");
    const cpus = os.cpus();
    
    // CPU usage calculation
    const cpuUsage = process.cpuUsage();
    const totalCpu = cpus.reduce((acc, cpu) => acc + (cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq), 0);
    const cpuPercent = (cpuUsage.user / 1000000) / (totalCpu / 1000000) * 100;
    
    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = (usedMem / totalMem) * 100;
    
    // Disk usage (simplified - would need proper disk stats in production)
    const diskPercent = 45 + Math.random() * 10;
    
    return {
      cpu: Math.min(cpuPercent, 100),
      memory: memoryPercent,
      disk: diskPercent,
      uptime: process.uptime(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
    };
  });

  // Database metrics endpoint
  app.get("/metrics/database", { preHandler: requireApiKey }, async () => {
    const prisma = getPrisma();
    
    try {
      // Get database size (PostgreSQL specific)
      const dbSizeResult = await prisma.$queryRaw<Array<{ pg_database_size: string }>>`
        SELECT pg_database_size('sovereign') as pg_database_size
      `;
      const dbSizeBytes = parseInt(dbSizeResult[0]?.pg_database_size || "0");
      const dbSizeMB = (dbSizeBytes / (1024 * 1024)).toFixed(1);
      
      // Get connection count
      const connectionResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE datname = 'sovereign'
      `;
      const connections = Number(connectionResult[0]?.count || 0);
      
      // Measure query time
      const queryStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const queryTime = Date.now() - queryStart;
      
      return {
        connections,
        size: `${dbSizeMB} MB`,
        queryTime,
        status: queryTime < 100 ? "healthy" : queryTime < 500 ? "degraded" : "down",
      };
    } catch (error) {
      logger.error({ msg: "database_metrics_error", error });
      return {
        connections: 0,
        size: "Unknown",
        queryTime: 0,
        status: "down",
      };
    }
  });

  // API metrics endpoint
  app.get("/metrics/api", { preHandler: requireApiKey }, async () => {
    // In production, these would come from actual metrics collection
    // For now, return simulated data
    return {
      requestsPerSecond: 10 + Math.random() * 50,
      avgResponseTime: 50 + Math.random() * 200,
      errorRate: Math.random() * 2,
      uptime: 99.9,
      totalRequests: Math.floor(Math.random() * 100000),
      totalErrors: Math.floor(Math.random() * 100),
    };
  });

  // Backup status endpoint
  app.get("/backup/status", { preHandler: requireApiKey }, async () => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    try {
      // Check for latest backup
      const { stdout } = await execAsync("ls -t /backups/sovereign_backup_*.sql.gz 2>/dev/null | head -n 1");
      const latestBackup = stdout.trim();
      
      if (latestBackup) {
        const stats = await import("fs").then(fs => fs.promises.stat(latestBackup));
        const lastBackupTime = new Date(stats.mtime);
        const nextBackupTime = new Date(lastBackupTime.getTime() + 24 * 60 * 60 * 1000);
        
        return {
          lastBackup: lastBackupTime.toISOString(),
          nextBackup: nextBackupTime.toISOString(),
          status: "success",
          retention: "7 days",
          backupFile: latestBackup.split("/").pop(),
        };
      } else {
        return {
          lastBackup: "Never",
          nextBackup: "Unknown",
          status: "pending",
          retention: "7 days",
        };
      }
    } catch (error) {
      return {
        lastBackup: "Unknown",
        nextBackup: "Unknown",
        status: "failed",
        retention: "7 days",
      };
    }
  });

  // Health check endpoint
  app.get("/health/detailed", async () => {
    const prisma = getPrisma();
    
    const checks = {
      database: false,
      api: true,
      backup: false,
    };
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }
    
    try {
      const { exec } = await import("child_process");
      await exec("ls /backups/sovereign_backup_*.sql.gz 2>/dev/null");
      checks.backup = true;
    } catch {
      checks.backup = false;
    }
    
    const allHealthy = Object.values(checks).every(Boolean);
    
    return {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
  });

  // Admin routes
  app.get("/users", { preHandler: requireJwtAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { users };
  });

  app.get("/backups", { preHandler: requireJwtAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync("ls -lh /backups/sovereign_backup_*.sql.gz 2>/dev/null");
      const lines = stdout.trim().split("\n");
      const backups = lines.map((line: string) => {
        const parts = line.trim().split(/\s+/);
        const filename = parts[parts.length - 1];
        const size = parts[4];
        return { filename, size, created: filename.match(/sovereign_backup_(\d{8}_\d{6})/)?.[1] || "" };
      }).filter((b: any) => b.filename);

      return { backups };
    } catch {
      return { backups: [] };
    }
  });

  app.post("/backups", { preHandler: requireJwtAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      await execAsync("/scripts/backup.sh");
      return { success: true, message: "Backup created successfully" };
    } catch (error) {
      logger.error({ msg: "backup_creation_failed", error });
      return reply.code(500).send({ error: "Failed to create backup" });
    }
  });

  app.post("/backups/:filename/restore", { preHandler: requireJwtAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const { filename } = request.params as { filename: string };
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    try {
      await execAsync(`/scripts/restore.sh /backups/${filename}`);
      logger.info({ msg: "backup_restored", filename, user: user.email });
      return { success: true, message: "Backup restored successfully" };
    } catch (error) {
      logger.error({ msg: "backup_restore_failed", error, filename });
      return reply.code(500).send({ error: "Failed to restore backup" });
    }
  });

  // Audit log routes
  app.get("/audit/logs", { preHandler: requireJwtAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const query = request.query as {
      action?: string;
      resource?: string;
      resourceId?: string;
      from?: string;
      to?: string;
      limit?: string;
      offset?: string;
    };

    const { logs, total } = await queryAuditLogs({
      organizationId: user.organizationId,
      action: query.action,
      resource: query.resource,
      resourceId: query.resourceId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit ? parseInt(query.limit) : 100,
      offset: query.offset ? parseInt(query.offset) : 0,
    });

    return { logs, total };
  });

  app.get("/audit/compliance-report", { preHandler: requireJwtAuth }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== "ADMIN") {
      return reply.code(403).send({ error: "Admin access required" });
    }

    const query = request.query as {
      from: string;
      to: string;
    };

    if (!query.from || !query.to) {
      return reply.code(400).send({ error: "from and to dates are required" });
    }

    const report = await generateComplianceReport({
      organizationId: user.organizationId,
      from: new Date(query.from),
      to: new Date(query.to),
    });

    return report;
  });
};
