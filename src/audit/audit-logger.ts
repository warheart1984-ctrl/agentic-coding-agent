import { getPrisma } from "../persistence/prisma.js";
import { logger } from "../logging/logger.js";

export interface AuditLogEntry {
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  organizationId: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const prisma = getPrisma();
  
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        oldValues: entry.oldValues || {} as any,
        newValues: entry.newValues || {} as any,
        metadata: entry.metadata || {} as any,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        userId: entry.userId,
        organizationId: entry.organizationId,
      },
    });
  } catch (error) {
    logger.error({ msg: "audit_log_creation_failed", error, entry });
    // Don't throw - audit logging failures shouldn't break the main flow
  }
}

/**
 * Create audit log entry from HTTP request
 */
export async function createAuditLogFromRequest(
  request: any,
  action: string,
  resource: string,
  resourceId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<void> {
  const user = (request as any).user;
  const organizationId = user?.organizationId || "default";
  
  await createAuditLog({
    action,
    resource,
    resourceId,
    oldValues,
    newValues,
    metadata,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
    userId: user?.id,
    organizationId,
  });
}

/**
 * Query audit logs with filtering
 */
export async function queryAuditLogs(params: {
  organizationId: string;
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}) {
  const prisma = getPrisma();
  
  const where: any = {
    organizationId: params.organizationId,
  };

  if (params.userId) {
    where.userId = params.userId;
  }

  if (params.action) {
    where.action = params.action;
  }

  if (params.resource) {
    where.resource = params.resource;
  }

  if (params.resourceId) {
    where.resourceId = params.resourceId;
  }

  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) {
      where.createdAt.gte = params.from;
    }
    if (params.to) {
      where.createdAt.lte = params.to;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit || 100,
      skip: params.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Get audit log statistics for compliance reporting
 */
export async function getAuditLogStats(params: {
  organizationId: string;
  from: Date;
  to: Date;
}) {
  const prisma = getPrisma();
  
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId: params.organizationId,
      createdAt: {
        gte: params.from,
        lte: params.to,
      },
    },
    select: {
      action: true,
      resource: true,
      userId: true,
      createdAt: true,
    },
  });

  // Calculate statistics
  const actionCounts = new Map<string, number>();
  const resourceCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();

  for (const log of logs) {
    actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
    resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
    if (log.userId) {
      userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
    }
  }

  return {
    totalLogs: logs.length,
    actionCounts: Object.fromEntries(actionCounts),
    resourceCounts: Object.fromEntries(resourceCounts),
    userCounts: Object.fromEntries(userCounts),
    period: {
      from: params.from,
      to: params.to,
    },
  };
}

/**
 * Generate compliance report
 */
export async function generateComplianceReport(params: {
  organizationId: string;
  from: Date;
  to: Date;
}) {
  const stats = await getAuditLogStats(params);
  
  // Get user activity summary
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      organizationId: params.organizationId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
    },
  });

  // Get sensitive action logs
  const sensitiveActions = ["USER_DELETE", "ORG_DELETE", "BACKUP_RESTORE", "SYSTEM_ADMIN"];
  const sensitiveLogs = await prisma.auditLog.findMany({
    where: {
      organizationId: params.organizationId,
      action: { in: sensitiveActions },
      createdAt: {
        gte: params.from,
        lte: params.to,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    organizationId: params.organizationId,
    reportGeneratedAt: new Date(),
    period: stats.period,
    summary: {
      totalAuditLogs: stats.totalLogs,
      totalUsers: users.length,
      sensitiveActionsCount: sensitiveLogs.length,
    },
    statistics: stats,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
      role: u.role,
      createdAt: u.createdAt,
      actionCount: stats.userCounts[u.id] || 0,
    })),
    sensitiveActions: sensitiveLogs.map((log) => ({
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      performedBy: log.user?.email || "Unknown",
      performedAt: log.createdAt,
      metadata: log.metadata,
    })),
  };
}
