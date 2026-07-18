import type { UUID } from "../../inas/spec/core";

export function uuid(): UUID {
  let id: string;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    id = globalThis.crypto.randomUUID();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require("crypto") as typeof import("crypto");
    id = randomUUID();
  }
  return id as UUID;
}
