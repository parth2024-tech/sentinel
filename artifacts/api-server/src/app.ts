import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust only the first proxy hop (Render's load balancer).
// Using `true` trusts all proxies and allows X-Forwarded-For spoofing.
// Using `1` means only the immediate upstream proxy is trusted, which is safe on Render.
app.set("trust proxy", 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// Adds X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security,
// Content-Security-Policy, and other critical security headers.
app.use(helmet());

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

// ── CORS — restrict to configured origins ─────────────────────────────────────
const defaultOrigins = [
  "https://sentinel-site-rosy.vercel.app",
  "https://sentinelapp.io",
  // Allow Vercel preview deployments
];

app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS?.split(",") ?? defaultOrigins;
    // Allow requests with no origin (Invoke-RestMethod, curl, mobile apps)
    if (!origin) return callback(null, true);
    // Allow configured origins + any vercel.app preview URL
    if (allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
}));


app.use(cookieParser());

// ── Body parser with explicit size cap ────────────────────────────────────────
// Enforced by the parser regardless of client-supplied content-length header.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// ── Health check ─────────────────────────────────────────────────────────────
// Used by Render health checks, uptime monitors, and the PowerShell script.
app.get("/health", (_req: Request, res: Response) => {
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
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "unhandled_error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
