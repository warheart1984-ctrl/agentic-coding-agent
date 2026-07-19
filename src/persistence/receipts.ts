import { getPrisma } from "./prisma.js";
import type { ProviderName } from "@prisma/client";

export interface Receipt {
  id: string;
  ledgerEntryId: string;
  provider: ProviderName;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  rawResponse?: Record<string, unknown>;
  createdAt: Date;
}

export async function insertReceipt(r: Omit<Receipt, "id" | "createdAt">): Promise<string> {
  const prisma = getPrisma();
  const created = await prisma.receipt.create({
    data: {
      ledgerEntryId: r.ledgerEntryId,
      provider: r.provider,
      model: r.model,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
      rawResponse: r.rawResponse as any,
    },
  });
  return created.id;
}

export async function getReceiptByLedgerId(ledgerEntryId: string): Promise<Receipt | null> {
  const prisma = getPrisma();
  const receipt = await prisma.receipt.findUnique({
    where: { ledgerEntryId },
  });
  if (!receipt) return null;
  return {
    id: receipt.id,
    ledgerEntryId: receipt.ledgerEntryId,
    provider: receipt.provider,
    model: receipt.model,
    tokensIn: receipt.tokensIn,
    tokensOut: receipt.tokensOut,
    costUsd: receipt.costUsd,
    latencyMs: receipt.latencyMs,
    rawResponse: receipt.rawResponse as Record<string, unknown> | undefined,
    createdAt: receipt.createdAt,
  };
}

export async function getReceiptsByProvider(provider: ProviderName, limit = 100): Promise<Receipt[]> {
  const prisma = getPrisma();
  const receipts = await prisma.receipt.findMany({
    where: { provider },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return receipts.map((r) => ({
    id: r.id,
    ledgerEntryId: r.ledgerEntryId,
    provider: r.provider,
    model: r.model,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    costUsd: r.costUsd,
    latencyMs: r.latencyMs,
    rawResponse: r.rawResponse as Record<string, unknown> | undefined,
    createdAt: r.createdAt,
  }));
}

export async function getTotalCostByProvider(provider: ProviderName): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.receipt.aggregate({
    where: { provider },
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}