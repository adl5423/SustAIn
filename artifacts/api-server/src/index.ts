import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];
const host = process.env["HOST"] ?? "127.0.0.1";

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
if (host.trim() === "" || host.length > 253 || /[\r\n\0]/.test(host)) {
  throw new Error("HOST must be a valid non-empty hostname or IP address.");
}

const server = app.listen(port, host, () => {
  logger.info({ host, port }, "Server listening");
});

server.once("error", (error) => {
  logger.fatal({ err: error, host, port }, "Server failed to listen");
  process.exitCode = 1;
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 1_000;

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, "Shutting down");
  const forcedExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  server.close((error) => {
    clearTimeout(forcedExit);
    if (error) {
      logger.error({ err: error }, "Server shutdown failed");
      process.exit(1);
    }
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
