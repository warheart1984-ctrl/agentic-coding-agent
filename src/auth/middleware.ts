import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";
import { findUserByApiKey, findUserByEmail, findUserById, createUser } from "../persistence/users.js";
import { logger } from "../logging/logger.js";
import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: number; email: string; role: string; apiKey?: string };
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  return `sk_${randomUUID().replace(/-/g, "")}`;
}

export async function createUserFn(email: string, password: string): Promise<number> {
  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();
  return createUser({ email, password_hash: passwordHash, api_key: apiKey, role: "operator" });
}

export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;
  return user;
}

export async function authenticateApiKey(apiKey: string) {
  return findUserByApiKey(apiKey);
}

const JWT_ALGORITHM = "HS256" as const;

function getJwtSecret(): string {
  return getEnv().JWT_SECRET;
}

export function signToken(payload: { id: number; email: string; role: string }): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: getEnv().JWT_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as {
      id: number;
      email: string;
      role: string;
    };
    return decoded;
  } catch {
    return null;
  }
}

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers["x-api-key"];

  if (!apiKey || Array.isArray(apiKey)) {
    return reply.code(401).send({ error: "Missing or invalid API key", code: "MISSING_API_KEY" });
  }

  const user = await authenticateApiKey(apiKey);

  if (!user) {
    logger.warn({ msg: "auth_invalid_api_key", ip: request.ip, requestId: request.requestId });
    return reply.code(401).send({ error: "Invalid API key", code: "INVALID_API_KEY" });
  }

  request.user = { id: user.id!, email: user.email, role: user.role, apiKey: user.api_key };
}

export async function requireJwtAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing or invalid Authorization header", code: "MISSING_TOKEN" });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    logger.warn({ msg: "auth_invalid_token", ip: request.ip, requestId: request.requestId });
    return reply.code(401).send({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
  }

  const user = await findUserById(payload.id);
  if (!user) {
    return reply.code(401).send({ error: "User not found", code: "USER_NOT_FOUND" });
  }

  request.user = { id: user.id!, email: user.email, role: user.role, apiKey: user.api_key };
}

export function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);
}