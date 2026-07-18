import pino from "pino";
import { getEnv } from "../config/env.js";

const env = getEnv();

const transport = env.NODE_ENV === "development" && env.LOG_PRETTY
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    }
  : undefined;

const options = {
  level: env.LOG_LEVEL,
  transport,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
};

const logger = pino(options);

export { logger };

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}