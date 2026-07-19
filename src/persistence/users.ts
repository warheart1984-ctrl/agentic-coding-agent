import { getPrisma } from "./prisma.js";
import { randomUUID } from "crypto";
import type { UserRole } from "@prisma/client";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  apiKey: string;
  role: UserRole;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createUser(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const prisma = getPrisma();
  const created = await prisma.user.create({
    data: {
      email: user.email,
      passwordHash: user.passwordHash,
      apiKey: user.apiKey,
      role: user.role,
      organizationId: user.organizationId,
    },
  });
  return created.id;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    apiKey: user.apiKey,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserByApiKey(apiKey: string): Promise<User | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { apiKey },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    apiKey: user.apiKey,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    apiKey: user.apiKey,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function generateApiKey(): string {
  return `sk_${randomUUID().replace(/-/g, "")}`;
}

export async function updateUserApiKey(userId: string, newApiKey: string): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.user.update({
    where: { id: userId },
    data: { apiKey: newApiKey },
  });
  return !!result;
}

export async function listUsers(organizationId: string, limit = 100, offset = 0): Promise<Omit<User, "passwordHash">[]> {
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: { organizationId },
    skip: offset,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      apiKey: true,
      role: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return users as unknown as Omit<User, "passwordHash">[];
}