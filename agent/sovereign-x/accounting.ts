import { uuid } from "../lib/uuid";
import { recordCSR } from "./kernel";
import type { UUID, Timestamp } from "../../inas/spec/core";

export type ResourceUnit = "cpu-ms" | "gpu-ms" | "memory-mb" | "tokens" | "calls";

export interface ResourceBudget {
  budgetId: string;
  agentId: string;
  intentId: string | null;
  limits: Partial<Record<ResourceUnit, number>>;
  consumed: Partial<Record<ResourceUnit, number>>;
  createdAt: Timestamp;
  resetAt: Timestamp | null;
}

export interface ResourceConsumption {
  consumptionId: string;
  budgetId: string;
  unit: ResourceUnit;
  amount: number;
  timestamp: Timestamp;
  taskId: string;
  approved: boolean;
}

const BUDGETS: Map<string, ResourceBudget> = new Map();
const CONSUMPTIONS: ResourceConsumption[] = [];

const DEFAULT_LIMITS: Record<string, Partial<Record<ResourceUnit, number>>> = {
  architect: { "cpu-ms": 60_000, "memory-mb": 512, "calls": 100 },
  builder: { "cpu-ms": 120_000, "memory-mb": 1024, "calls": 200 },
  implementor: { "cpu-ms": 300_000, "memory-mb": 2048, "calls": 500 },
  validator: { "cpu-ms": 60_000, "memory-mb": 512, "calls": 100 },
  reviewer: { "cpu-ms": 120_000, "memory-mb": 1024, "calls": 150 },
};

export function createBudget(agentId: string, intentId: string | null, customLimits?: Partial<Record<ResourceUnit, number>>): ResourceBudget {
  const roleKey = agentId.split("-")[0];
  const defaultLimits = DEFAULT_LIMITS[roleKey] || { "cpu-ms": 60_000, "memory-mb": 512, "calls": 50 };
  const budget: ResourceBudget = {
    budgetId: uuid(),
    agentId,
    intentId,
    limits: customLimits ?? defaultLimits,
    consumed: { "cpu-ms": 0, "memory-mb": 0, "tokens": 0, "calls": 0 },
    createdAt: new Date().toISOString(),
    resetAt: null,
  };
  BUDGETS.set(budget.budgetId, budget);
  recordCSR("budget-created", "accounting", { budgetId: budget.budgetId, agentId, limits: budget.limits }, intentId as UUID | null, "sovereign-x-accounting");
  return budget;
}

export function getBudget(budgetId: string): ResourceBudget | undefined {
  return BUDGETS.get(budgetId);
}

export function getAgentBudget(agentId: string): ResourceBudget | undefined {
  return Array.from(BUDGETS.values()).find((b) => b.agentId === agentId && b.resetAt === null);
}

export function consumeResource(
  budgetId: string, unit: ResourceUnit, amount: number, taskId: string,
): { ok: boolean; remaining: number; error?: string } {
  const budget = BUDGETS.get(budgetId);
  if (!budget) return { ok: false, remaining: 0, error: `Budget ${budgetId} not found` };

  const limit = budget.limits[unit] ?? Infinity;
  const current = budget.consumed[unit] ?? 0;
  const remaining = limit - current;

  if (remaining < amount) {
    const consumption: ResourceConsumption = {
      consumptionId: uuid(), budgetId, unit, amount, timestamp: new Date().toISOString(), taskId, approved: false,
    };
    CONSUMPTIONS.push(consumption);
    recordCSR("resource-exceeded", "accounting", { budgetId, unit, amount, current, limit, taskId }, null, "sovereign-x-accounting");
    return { ok: false, remaining, error: `${unit} limit exceeded: ${current + amount} > ${limit}` };
  }

  budget.consumed[unit] = (current + amount);
  const consumption: ResourceConsumption = {
    consumptionId: uuid(), budgetId, unit, amount, timestamp: new Date().toISOString(), taskId, approved: true,
  };
  CONSUMPTIONS.push(consumption);
  recordCSR("resource-consumed", "accounting", { budgetId, unit, amount, remaining: remaining - amount, taskId }, null, "sovereign-x-accounting");

  return { ok: true, remaining: remaining - amount };
}

export function resetBudget(budgetId: string): boolean {
  const budget = BUDGETS.get(budgetId);
  if (!budget) return false;
  budget.consumed = { "cpu-ms": 0, "memory-mb": 0, "tokens": 0, "calls": 0 };
  budget.resetAt = new Date().toISOString();
  recordCSR("budget-reset", "accounting", { budgetId }, null, "sovereign-x-accounting");
  return true;
}

export function getBudgetUsage(budgetId: string): { budget: ResourceBudget | undefined; usage: Array<{ unit: ResourceUnit; consumed: number; limit: number; remaining: number }> } {
  const budget = BUDGETS.get(budgetId);
  if (!budget) return { budget: undefined, usage: [] };
  const usage = (Object.keys(budget.limits) as ResourceUnit[]).map((unit) => ({
    unit,
    consumed: budget.consumed[unit] ?? 0,
    limit: budget.limits[unit] ?? Infinity,
    remaining: (budget.limits[unit] ?? Infinity) - (budget.consumed[unit] ?? 0),
  }));
  return { budget, usage };
}

export function listConsumptions(budgetId?: string): ResourceConsumption[] {
  if (budgetId) return CONSUMPTIONS.filter((c) => c.budgetId === budgetId);
  return [...CONSUMPTIONS];
}

export function getAccountingStatus(): { budgetCount: number; totalConsumptions: number; recentExceeded: number } {
  return {
    budgetCount: BUDGETS.size,
    totalConsumptions: CONSUMPTIONS.length,
    recentExceeded: CONSUMPTIONS.filter((c) => !c.approved).length,
  };
}

export function resetAccounting(): void {
  BUDGETS.clear();
  CONSUMPTIONS.length = 0;
}
