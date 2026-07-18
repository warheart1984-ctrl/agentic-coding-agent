import { randomUUID } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { logger } from "./logger.js";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

export async function requestIdMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const existing = request.headers["x-request-id"] as string | undefined;
  const requestId = existing ?? randomUUID();

  request.requestId = requestId;
  request.headers["x-request-id"] = requestId;

  const childLogger = logger.child({ requestId });

  childLogger.info({
    msg: "incoming_request",
    method: request.method,
    path: request.url,
    requestId,
  });
}

export function getRequestId(request: FastifyRequest): string {
  return request.requestId ?? "unknown";
}