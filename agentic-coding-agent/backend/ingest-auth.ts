import type { IncomingMessage, ServerResponse } from "http";

export function ingestToken(): string {
  return (
    process.env.NOVA_OBSERVE_TOKEN ||
    process.env.NOVA_SPINE_INGEST_TOKEN ||
    ""
  );
}

export function isLoopbackAddress(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? "";
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function readIngestTokenHeader(req: IncomingMessage): string {
  const header = req.headers["x-nova-ingest-token"];
  if (typeof header === "string") return header;
  if (Array.isArray(header)) return header[0] ?? "";
  return "";
}

/** Fail closed in production without token; dev allows localhost without token. */
export function authorizeReceiptIngest(
  req: IncomingMessage,
  res: ServerResponse,
  respond: (status: number, message: string) => void,
): boolean {
  const expected = ingestToken();
  const provided = readIngestTokenHeader(req);

  if (expected) {
    if (provided !== expected) {
      respond(401, "Unauthorized ingest");
      return false;
    }
    return true;
  }

  if (isProductionEnv()) {
    respond(503, "Receipt ingest disabled — set NOVA_OBSERVE_TOKEN or NOVA_SPINE_INGEST_TOKEN");
    return false;
  }

  if (isLoopbackAddress(req)) {
    return true;
  }

  respond(403, "Receipt ingest allowed from localhost only when no ingest token is configured");
  return false;
}
