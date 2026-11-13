import { z } from "zod";
import { logger } from "./lib/logger.js";

// ── Env validation on startup (#8) ────────────────────────────────────────────
// Fails fast with a clear error instead of crashing at runtime.
const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  SERVER_SECRET: z.string().default("sentinel-default-server-secret-key-32-chars-long"),
});

let env: z.infer<typeof EnvSchema>;
try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  logger.fatal(
    { error },
    "Startup environment validation failed. Ensure required environment variables (e.g. DATABASE_URL) are set."
  );
  process.exit(1);
}

// Import app after env validation so DB init uses validated env
import app from "./app.js";
import { startCleanupScheduler } from "./lib/cleanupScheduler.js";
import { initQueue, stopQueue } from "./lib/queue/index.js";
import { closeAllStreams } from "./lib/liveFeed.js";

const port = env.PORT;

const server = app.listen(port, "0.0.0.0", () => {
  logger.info({ port, host: "0.0.0.0" }, "Server listening");
  initQueue().catch((err) => {
    logger.error({ err }, "Background queue failed to initialize");
  });
  try {
    startCleanupScheduler();
  } catch (err) {
    logger.error({ err }, "Cleanup scheduler failed to start");
  }
});

// ── Graceful shutdown (#13) ───────────────────────────────────────────────────
// Allows in-flight requests to complete before process exits on SIGTERM/SIGINT.
function shutdown(signal: string) {
  logger.info({ signal }, "shutdown_initiated");
  // Drain all active SSE connections immediately so server.close() does not hang
  closeAllStreams();
  server.close(async () => {
    logger.info("http_server_closed");
    await stopQueue();
    logger.info("background_queue_closed");
    // Close DB pool here if using a pool manager
    process.exit(0);
  });
  // Force-kill after 10s if connections hang
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Unhandled rejection / exception guards (#4) ──────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled_rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught_exception");
  process.exit(1);
});
