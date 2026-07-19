import { getPrisma } from "./prisma.js";
import type { IntentType, TrustTier } from "@prisma/client";

export interface LedgerEntry {
  id: string;
  intent: string;
  intentType: IntentType;
  actor: string;
  evidence: Record<string, unknown>;
  result?: Record<string, unknown>;
  trustScore?: number;
  trustTier?: TrustTier;
  requestId: string;
  organizationId: string;
  projectId?: string;
  createdAt: Date;
}

export interface LedgerQueryOptions {
  actor?: string;
  intentType?: IntentType;
  organizationId?: string;
  projectId?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
}

export async function insertLedger(entry: Omit<LedgerEntry, "id" | "createdAt">): Promise<string> {
  const prisma = getPrisma();
  const created = await prisma.ledgerEntry.create({
    data: {
      intent: entry.intent,
      intentType: entry.intentType,
      actor: entry.actor,
      evidence: entry.evidence as any,
      result: entry.result as any,
      trustScore: entry.trustScore,
      trustTier: entry.trustTier,
      requestId: entry.requestId,
      organizationId: entry.organizationId,
      projectId: entry.projectId,
    },
  });
  return created.id;
}

export async function getLedgerById(id: string): Promise<LedgerEntry | null> {
  const prisma = getPrisma();
  const entry = await prisma.ledgerEntry.findUnique({
    where: { id },
  });
  if (!entry) return null;
  return {
    id: entry.id,
    intent: entry.intent,
    intentType: entry.intentType,
    actor: entry.actor,
    evidence: entry.evidence as Record<string, unknown>,
    result: entry.result as Record<string, unknown> | undefined,
    trustScore: entry.trustScore ?? undefined,
    trustTier: entry.trustTier ?? undefined,
    requestId: entry.requestId,
    organizationId: entry.organizationId,
    projectId: entry.projectId ?? undefined,
    createdAt: entry.createdAt,
  };
}

export async function queryLedger(options: LedgerQueryOptions = {}): Promise<LedgerEntry[]> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};

  if (options.actor) where.actor = options.actor;
  if (options.intentType) where.intentType = options.intentType;
  if (options.organizationId) where.organizationId = options.organizationId;
  if (options.projectId) where.projectId = options.projectId;
  if (options.fromTimestamp || options.toTimestamp) {
    where.createdAt = {};
    if (options.fromTimestamp) (where.createdAt as any).gte = options.fromTimestamp;
    if (options.toTimestamp) (where.createdAt as any).lte = options.toTimestamp;
  }

  const entries = await prisma.ledgerEntry.findMany({
    where,
    skip: options.offset ?? 0,
    take: options.limit ?? 100,
    orderBy: { createdAt: "desc" },
  });

  return entries.map((entry) => ({
    id: entry.id,
    intent: entry.intent,
    intentType: entry.intentType,
    actor: entry.actor,
    evidence: entry.evidence as Record<string, unknown>,
    result: entry.result as Record<string, unknown> | undefined,
    trustScore: entry.trustScore ?? undefined,
    trustTier: entry.trustTier ?? undefined,
    requestId: entry.requestId,
    organizationId: entry.organizationId,
    projectId: entry.projectId ?? undefined,
    createdAt: entry.createdAt,
  }));
}

export async function countLedger(options: Omit<LedgerQueryOptions, "limit" | "offset"> = {}): Promise<number> {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {};

  if (options.actor) where.actor = options.actor;
  if (options.intentType) where.intentType = options.intentType;
  if (options.organizationId) where.organizationId = options.organizationId;
  if (options.projectId) where.projectId = options.projectId;
  if (options.fromTimestamp || options.toTimestamp) {
    where.createdAt = {};
    if (options.fromTimestamp) (where.createdAt as any).gte = options.fromTimestamp;
    if (options.toTimestamp) (where.createdAt as any).lte = options.toTimestamp;
  }

  return await prisma.ledgerEntry.count({ where });
}