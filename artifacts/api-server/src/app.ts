import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const allowedOrigins = new Set(
  (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const rawCorsCredentials = process.env["CORS_ALLOW_CREDENTIALS"] ?? "false";
if (rawCorsCredentials !== "true" && rawCorsCredentials !== "false") {
  throw new Error('CORS_ALLOW_CREDENTIALS must be "true" or "false".');
}
const allowCorsCredentials = rawCorsCredentials === "true";
const trustProxyHops = Number(process.env["TRUST_PROXY_HOPS"] ?? "0");

class CorsOriginError extends Error {}

if (
  !Number.isInteger(trustProxyHops) ||
  trustProxyHops < 0 ||
  trustProxyHops > 2
) {
  throw new Error("TRUST_PROXY_HOPS must be an integer from 0 through 2.");
}

app.disable("x-powered-by");
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet());
app.use(
  cors({
    credentials: allowCorsCredentials,
    methods: ["GET", "HEAD", "OPTIONS", "POST"],
    allowedHeaders: ["authorization", "content-type", "x-request-id"],
    maxAge: 600,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(
        new CorsOriginError("Origin is not allowed by CORS policy."),
      );
    },
  }),
);
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "RATE_LIMITED", message: "Too many requests." },
  }),
);
app.use(express.json({ limit: "64kb", strict: true }));
app.use(
  express.urlencoded({ extended: false, limit: "32kb", parameterLimit: 100 }),
);

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found." });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;
  const status = resolveErrorStatus(error);
  if (status >= 500) req.log.error({ err: error }, "Request failed");
  else req.log.warn({ status }, "Request rejected");
  res.status(status).json(errorResponse(status));
};

app.use(errorHandler);

export default app;

function resolveErrorStatus(error: unknown): number {
  if (error instanceof CorsOriginError) return 403;
  if (error && typeof error === "object") {
    const candidate = (error as { status?: unknown }).status;
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= 400 &&
      candidate < 500
    ) {
      return candidate;
    }
  }
  return 500;
}

function errorResponse(status: number): { error: string; message: string } {
  if (status === 400)
    return { error: "BAD_REQUEST", message: "The request is invalid." };
  if (status === 403)
    return {
      error: "FORBIDDEN",
      message: "The request origin is not allowed.",
    };
  if (status === 413) {
    return {
      error: "PAYLOAD_TOO_LARGE",
      message: "The request body exceeds the limit.",
    };
  }
  if (status === 429)
    return { error: "RATE_LIMITED", message: "Too many requests." };
  return {
    error: "INTERNAL_SERVER_ERROR",
    message: "The request could not be completed.",
  };
}
