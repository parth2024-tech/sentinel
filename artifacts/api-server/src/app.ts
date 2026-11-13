import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Trust only the first proxy hop (Render's load balancer).
// Using `true` trusts all proxies and allows X-Forwarded-For spoofing.
// Using `1` means only the immediate upstream proxy is trusted, which is safe on Render.
app.set("trust proxy", 1);

// Safe CJS/ESM interop resolvers for Vercel/Node compilation
const helmetFn = ((helmet as any)?.default ?? helmet) as (...args: any[]) => any;
const pinoHttpFn = ((pinoHttp as any)?.default ?? pinoHttp) as (...args: any[]) => any;

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// Adds X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security,
// Content-Security-Policy, and other critical security headers.
app.use(
  helmetFn({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://sentinelapp.io", "https://*.vercel.app"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
  })
);

app.use(
  pinoHttpFn({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS — restrict to verified production and team preview origins ──────────
const EXACT_PRODUCTION_ORIGINS = new Set([
  "https://sentinelapp.io",
  "https://www.sentinelapp.io",
]);

// Scoped preview origin matcher — allows preview builds without credential reflection
const isAllowedPreviewOrigin = (origin: string): boolean => {
  return /^https:\/\/(sentinel-site|novasentinel)[a-z0-9-]*\.vercel\.app$/.test(origin);
};

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    // Allow non-browser agents (PowerShell, CLI, curl) with no origin header
    if (!origin) {
      callback(null, { origin: true, credentials: false });
      return;
    }

    const isProdOrigin = EXACT_PRODUCTION_ORIGINS.has(origin);
    const isDev = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    if (isProdOrigin || isDev) {
      // Credentials exclusively allowed for verified production and local dev origins
      callback(null, {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "OPTIONS", "DELETE", "PUT", "PATCH"],
      });
      return;
    }

    if (isAllowedPreviewOrigin(origin)) {
      // Preview branches use Vercel Rewrite Proxies (/api/* -> backend) for same-origin session auth.
      // Cross-origin preview requests NEVER reflect credentials to prevent XSS exfiltration of sentinel_session.
      callback(null, {
        origin: true,
        credentials: false,
        methods: ["GET", "POST", "OPTIONS", "DELETE", "PUT", "PATCH"],
      });
      return;
    }

    callback(null, { origin: false });
  })
);

app.use(cookieParser());

// ── Anti-CSRF Guard for Cookie-Authenticated State Mutations ─────────────────
// Rejects mutating requests (POST, PUT, DELETE, PATCH) bearing session cookies
// if flagged as cross-site by modern browser Sec-Fetch-Site metadata
app.use((req: Request, res: Response, next: NextFunction) => {
  const isMutating = ["POST", "PUT", "DELETE", "PATCH"].includes(req.method);
  const cookies = req.cookies as Record<string, string> | undefined;
  const hasSessionCookie = Boolean(cookies?.["__Host-sentinel_session"] || cookies?.["sentinel_session"]);
  const secFetchSite = req.headers["sec-fetch-site"];

  if (isMutating && hasSessionCookie && secFetchSite === "cross-site") {
    res.status(403).json({ error: "Cross-site request forgery protection triggered." });
    return;
  }
  next();
});

// ── Body parser with explicit size cap & raw buffer capture ──────────────────
// Preserves exact wire bytes in req.rawBody for cryptographic attestation verification
app.use(
  express.json({
    limit: "256kb",
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// ── Health check ─────────────────────────────────────────────────────────────
// Used by Render health checks, uptime monitors, root ping, and the PowerShell script.
app.get(["/", "/health"], (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "sentinel-api",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────────────────
// Must be 4-argument signature for Express to treat it as error handler.
// Catches unhandled async errors and prevents stack trace leaks in production.
// In development, stack traces are returned to the caller to aid debugging.
// In production, only the correlation ID (req.id) is returned — link it to logs.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const reqId = (req as Request & { id?: string }).id ?? "unknown";
  logger.error({ err, url: req.url, method: req.method, reqId }, "unhandled_error");
  if (res.headersSent) return;
  // Always return the correlation ID so client support tickets can be matched to logs
  res.setHeader("X-Request-Id", reqId);
  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    res.status(500).json({ error: err.message, stack: err.stack, reqId });
  } else {
    res.status(500).json({ error: "Internal server error", reqId });
  }
});

export default app;
