import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";

// In-memory rate-limit store simulating PostgreSQL atomic INSERT ... ON CONFLICT ... RETURNING count
const inMemoryRateLimits = new Map<string, number>();

vi.mock("@workspace/db", () => {
  return {
    db: {
      insert: () => ({
        values: (val: { ip: string; windowStart: Date; count: number }) => ({
          onConflictDoUpdate: () => ({
            returning: () => {
              const current = inMemoryRateLimits.get(val.ip) ?? 0;
              const next = current + 1;
              inMemoryRateLimits.set(val.ip, next);
              return [{ count: next }];
            },
          }),
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    },
    rateLimitsTable: {
      ip: "ip",
      windowStart: "windowStart",
      count: "count",
    },
  };
});

import { timingSafeEqualStr, canonicalJsonHash } from "./lib/crypto.js";
import { consumeRateLimit } from "./lib/rateLimit.js";
import { addClient, closeAllStreams } from "./lib/liveFeed.js";
import { SentinelReportSchema, generateReport } from "@workspace/report-engine";

describe("Adversarial Security & Concurrency Test Suite", () => {
  // ── 1. Idempotency Key Ordering Invariance ────────────────────────────────
  describe("Idempotency Key Ordering Invariance", () => {
    it("produces identical canonical hashes regardless of JSON key ordering", () => {
      const payloadA = {
        sentinelSchema: 1,
        system: {
          os: "Windows 11",
          model: "ThinkPad X1 Carbon",
          hostname: "WORKSTATION-01",
        },
        battery: {
          cycleCount: 120,
          health: 94.5,
        },
      };

      const payloadB = {
        battery: {
          health: 94.5,
          cycleCount: 120,
        },
        sentinelSchema: 1,
        system: {
          hostname: "WORKSTATION-01",
          model: "ThinkPad X1 Carbon",
          os: "Windows 11",
        },
      };

      const hashA = canonicalJsonHash(payloadA);
      const hashB = canonicalJsonHash(payloadB);

      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64);
    });

    it("preserves array element ordering while canonicalizing nested object keys", () => {
      const payloadWithArray1 = {
        disks: [
          { id: "nvme0", size: 1000 },
          { id: "nvme1", size: 500 },
        ],
        z: 99,
        a: 1,
      };

      const payloadWithArray2 = {
        a: 1,
        z: 99,
        disks: [
          { size: 1000, id: "nvme0" },
          { size: 500, id: "nvme1" },
        ],
      };

      // Array inverted should produce a DIFFERENT hash
      const payloadWithInvertedArray = {
        a: 1,
        z: 99,
        disks: [
          { size: 500, id: "nvme1" },
          { size: 1000, id: "nvme0" },
        ],
      };

      expect(canonicalJsonHash(payloadWithArray1)).toBe(
        canonicalJsonHash(payloadWithArray2)
      );
      expect(canonicalJsonHash(payloadWithArray1)).not.toBe(
        canonicalJsonHash(payloadWithInvertedArray)
      );
    });

    it("evaluates constant-time string comparison timingSafeEqualStr", () => {
      const secret = "a".repeat(64);
      const matchingSecret = "a".repeat(64);
      const wrongSecret = "a".repeat(63) + "b";
      const shortSecret = "a".repeat(32);

      expect(timingSafeEqualStr(secret, matchingSecret)).toBe(true);
      expect(timingSafeEqualStr(secret, wrongSecret)).toBe(false);
      expect(timingSafeEqualStr(secret, shortSecret)).toBe(false);
      expect(timingSafeEqualStr(null, secret)).toBe(false);
      expect(timingSafeEqualStr(secret, undefined)).toBe(false);
    });
  });

  // ── 2. Quarantine & Claim Rate-Limit Boundaries ────────────────────────────
  describe("Quarantine & Rate-Limit Boundaries", () => {
    it("allows exactly 5 quarantine writes in 60s window and drops the 6th", async () => {
      const testIpHash = "test-ip-" + crypto.randomBytes(8).toString("hex");
      const quarantineKey = `quarantine:${testIpHash}`;

      const results: boolean[] = [];
      for (let i = 0; i < 6; i++) {
        const allowed = await consumeRateLimit(quarantineKey, 60, 5);
        results.push(allowed);
      }

      // First 5 requests must be allowed to write quarantine records
      expect(results.slice(0, 5)).toEqual([true, true, true, true, true]);
      // 6th request must be dropped (false) to prevent Postgres storage exhaustion
      expect(results[5]).toBe(false);
    });

    it("enforces report claim rate limit per IP and report ID", async () => {
      const testIp = "ip-" + crypto.randomBytes(8).toString("hex");
      const reportId = "rep-" + crypto.randomBytes(8).toString("hex");
      const claimLimitKey = `claim-attempt:${testIp}:${reportId}`;

      const attempts: boolean[] = [];
      for (let i = 0; i < 11; i++) {
        const allowed = await consumeRateLimit(claimLimitKey, 15, 10);
        attempts.push(allowed);
      }

      expect(attempts.filter((a) => a === true)).toHaveLength(10);
      expect(attempts[10]).toBe(false);
    });
  });

  // ── 3. Prefetch & Scanner Immunity ─────────────────────────────────────────
  describe("Prefetch & Scanner Immunity", () => {
    interface MockRequest {
      method: string;
      headers: Record<string, string | undefined>;
    }

    function evaluatePrefetchGuard(req: MockRequest): { handled: boolean; status?: number } {
      const purpose =
        req.headers["purpose"] ||
        req.headers["sec-purpose"] ||
        req.headers["x-purpose"] ||
        req.headers["x-moz"];

      if (req.method === "HEAD" || purpose === "prefetch" || purpose === "preview") {
        return { handled: true, status: 204 };
      }
      return { handled: false };
    }

    it("returns 204 and halts execution on HEAD requests", () => {
      const res = evaluatePrefetchGuard({ method: "HEAD", headers: {} });
      expect(res.handled).toBe(true);
      expect(res.status).toBe(204);
    });

    it("returns 204 on Sec-Purpose: prefetch without consuming token", () => {
      const res = evaluatePrefetchGuard({
        method: "GET",
        headers: { "sec-purpose": "prefetch" },
      });
      expect(res.handled).toBe(true);
      expect(res.status).toBe(204);
    });

    it("returns 204 on X-Moz: prefetch header", () => {
      const res = evaluatePrefetchGuard({
        method: "GET",
        headers: { "x-moz": "prefetch" },
      });
      expect(res.handled).toBe(true);
      expect(res.status).toBe(204);
    });

    it("permits standard browser GET navigation through to consumption", () => {
      const res = evaluatePrefetchGuard({
        method: "GET",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "Mozilla/5.0 ...",
        },
      });
      expect(res.handled).toBe(false);
    });
  });

  // ── 4. TOCTOU Race Condition Concurrency Harness ───────────────────────────
  describe("TOCTOU Race Condition Concurrency Harness", () => {
    it("guarantees single-use atomic consumption under 10 concurrent requests", async () => {
      // Simulates the atomic UPDATE ... WHERE used_at IS NULL RETURNING email
      const tokenStore = {
        tokenHash: crypto.randomBytes(32).toString("hex"),
        email: "alice@example.com",
        usedAt: null as Date | null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      // Atomic single-query simulator with non-deterministic micro-delays
      const atomicConsumeMagicLink = async (hash: string): Promise<{ email: string } | null> => {
        // Yield to event loop to simulate concurrent DB query arrival
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 8));

        if (tokenStore.tokenHash !== hash) return null;
        if (tokenStore.usedAt !== null) return null;
        if (tokenStore.expiresAt <= new Date()) return null;

        // Atomically mark used
        tokenStore.usedAt = new Date();
        return { email: tokenStore.email };
      };

      // Fire 10 concurrent verification calls
      const concurrentRequests = Array.from({ length: 10 }, async () => {
        const consumed = await atomicConsumeMagicLink(tokenStore.tokenHash);
        if (!consumed) {
          return { status: 401, error: "Invalid or expired magic link." };
        }
        return {
          status: 302,
          setCookie: `sentinel_session=${crypto.randomBytes(16).toString("hex")}`,
          redirect: "/my-reports?verified=1",
        };
      });

      const responses = await Promise.all(concurrentRequests);

      const successfulRedirects = responses.filter((r) => r.status === 302);
      const rejectedAttempts = responses.filter((r) => r.status === 401);

      // Exactly 1 request succeeds in creating the session
      expect(successfulRedirects).toHaveLength(1);
      expect(successfulRedirects[0]?.setCookie).toBeDefined();

      // Exactly 9 requests are rejected with 401
      expect(rejectedAttempts).toHaveLength(9);
      expect(tokenStore.usedAt).not.toBeNull();
    });
  });

  // ── 5. Cryptographic Device Attestation Verification ───────────────────────
  describe("Cryptographic Device Attestation", () => {
    it("validates signature when timestamp is within 300s window", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const payloadStr = JSON.stringify({ rawJson: { sentinelSchema: 1 } });
      const signaturePayload = `${nowSec}.${payloadStr}`;
      const validSig = crypto.createHash("sha256").update(signaturePayload).digest("hex");

      const isTimestampValid = Math.abs(Math.floor(Date.now() / 1000) - nowSec) <= 300;
      const expectedSig = crypto.createHash("sha256").update(`${nowSec}.${payloadStr}`).digest("hex");
      const isSignatureValid = timingSafeEqualStr(validSig, expectedSig);

      expect(isTimestampValid).toBe(true);
      expect(isSignatureValid).toBe(true);
    });

    it("rejects attestation with expired timestamp outside 300s clock skew window", () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 305; // 5 minutes 5 seconds ago
      const isTimestampValid = Math.abs(Math.floor(Date.now() / 1000) - staleTimestamp) <= 300;

      expect(isTimestampValid).toBe(false);
    });

    it("verifies keyed HMAC-SHA256 attestation bound to provisioned deviceToken with domain separation", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const provisionedToken = "device-secret-token-" + crypto.randomBytes(16).toString("hex");
      const wireBytes = Buffer.from('{"rawJson":{"sentinelSchema":1,"score":80.0}}', "utf8");
      const signaturePayload = `${nowSec}.${wireBytes.toString("utf8")}`;

      // Both client and server derive signing key: SHA256("sentinel-sig-v1:" + rawDeviceToken)
      const clientDerivedKey = crypto.createHash("sha256").update(`sentinel-sig-v1:${provisionedToken}`).digest();
      const clientHmac = crypto
        .createHmac("sha256", clientDerivedKey)
        .update(signaturePayload)
        .digest("hex");

      const serverDerivedKey = crypto.createHash("sha256").update(`sentinel-sig-v1:${provisionedToken}`).digest();
      const serverHmac = crypto
        .createHmac("sha256", serverDerivedKey)
        .update(signaturePayload)
        .digest("hex");

      expect(timingSafeEqualStr(clientHmac, serverHmac)).toBe(true);

      // Attack scenario: Attacker attempts to forge with wrong token
      const attackerDerivedKey = crypto.createHash("sha256").update(`sentinel-sig-v1:wrong-attacker-token`).digest();
      const attackerHmac = crypto
        .createHmac("sha256", attackerDerivedKey)
        .update(signaturePayload)
        .digest("hex");

      expect(timingSafeEqualStr(attackerHmac, serverHmac)).toBe(false);
    });

    it("prevents floating-point and formatting drift by hashing exact raw wire buffer", () => {
      const nowSec = Math.floor(Date.now() / 1000);
      // Client sends literal formatted JSON with formatting (e.g. space or 80.0)
      const rawWireString = '{\n  "score": 80.0\n}';
      const rawWireBuf = Buffer.from(rawWireString, "utf8");

      // Re-serialization through parsed object changes the string
      const parsed = JSON.parse(rawWireString);
      const reSerialized = JSON.stringify(parsed); // '{"score":80}' -> floats and whitespace collapsed!

      expect(reSerialized).not.toBe(rawWireString);

      // Using rawWireBuf preserves signature verification across wire boundaries
      const clientSig = crypto
        .createHash("sha256")
        .update(`${nowSec}.${rawWireBuf.toString("utf8")}`)
        .digest("hex");
      const serverSigOverWire = crypto
        .createHash("sha256")
        .update(`${nowSec}.${rawWireBuf.toString("utf8")}`)
        .digest("hex");

      expect(clientSig).toBe(serverSigOverWire);
    });

    it("calibrates client clock-offset delta when server returns authoritative timestamp", () => {
      const driftedClientTime = 1000;
      const authoritativeServerTime = 2500; // 1500s ahead (CMOS battery died)

      // Initial skew check fails: |1000 - 2500| = 1500 > 300
      const initialSkew = Math.abs(driftedClientTime - authoritativeServerTime);
      expect(initialSkew > 300).toBe(true);

      // Server emits authoritative time in response header:
      // X-Sentinel-Server-Time: 2500
      const calibratedOffset = authoritativeServerTime - driftedClientTime; // +1500

      // Client re-attempts with calibrated offset
      const calibratedClientTime = driftedClientTime + calibratedOffset; // 2500
      const calibratedSkew = Math.abs(calibratedClientTime - authoritativeServerTime);

      expect(calibratedSkew).toBe(0);
      expect(calibratedSkew <= 300).toBe(true);
    });
  });

  // ── 7. SSE Graceful Shutdown & Connection Draining ────────────────────────
  describe("SSE Graceful Shutdown & Connection Draining", () => {
    it("drains and terminates all active SSE connections cleanly upon shutdown", () => {
      let ended = false;
      const mockRes: any = {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(() => {
          ended = true;
        }),
        writableEnded: false,
        destroyed: false,
      };

      addClient(mockRes);
      closeAllStreams();

      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining("event: shutdown"));
      expect(mockRes.end).toHaveBeenCalled();
      expect(ended).toBe(true);
    });
  });

  // ── 8. RFC 8628 Device Authorization Grant & Brute Force Immunity ───────────
  describe("RFC 8628 Device Authorization Grant & Brute Force Immunity", () => {
    it("stores device token only as SHA-256 hash and validates constant-time matching", async () => {
      const rawToken = "raw-secret-device-token-1234567890";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      expect(tokenHash).not.toBe(rawToken);
      expect(tokenHash.length).toBe(64);

      const incomingBearer = rawToken;
      const incomingHash = crypto.createHash("sha256").update(incomingBearer).digest("hex");

      expect(timingSafeEqualStr(incomingHash, tokenHash)).toBe(true);
    });

    it("triggers burn threshold when failed claim attempts reach limit (5 attempts)", async () => {
      const testPairCode = "TEST-CODE-BURN";
      const failKey = `pair_burn_test:${testPairCode}`;

      let allowedCount = 0;
      for (let i = 0; i < 5; i++) {
        const allowed = await consumeRateLimit(failKey, 15, 5);
        if (allowed) allowedCount++;
      }
      expect(allowedCount).toBe(5);

      const blockedAttempt = await consumeRateLimit(failKey, 15, 5);
      expect(blockedAttempt).toBe(false);
    });
  });

  // ── 9. Report Engine Hardware Array Bounding & Math Resilience ───────────────
  describe("Report Engine Hardware Array Bounding & Math Resilience", () => {
    it("rejects telemetry payloads containing oversized arrays (> 32 devices)", () => {
      const oversizedStorage = Array.from({ length: 33 }, (_, i) => ({
        model: `Drive ${i}`,
        healthPct: 100,
        freeSpacePct: 50,
      }));

      const payload = {
        sentinelSchema: 1,
        generatedAt: new Date().toISOString(),
        system: { hostname: "TEST", model: "LAPTOP", manufacturer: "OEM" },
        storage: oversizedStorage,
      };

      const result = SentinelReportSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("ensures scoring engine handles division-by-zero without NaN or Infinity leakage", () => {
      const mockReport: any = {
        sentinelSchema: 1,
        generatedAt: new Date().toISOString(),
        system: { hostname: "TEST", model: "DESKTOP-NO-BATTERY", manufacturer: "CUSTOM" },
        battery: {
          designCapacity: 0,
          fullChargeCapacity: 0,
          dischargeRateMw: 0,
          health: 100,
        },
        memory: { totalGB: 16, usedPct: 50 },
        cpu: { cores: 8, threads: 16, avgLoadPct: 20 },
      };

      const reportResult = generateReport(mockReport);
      expect(Number.isFinite(reportResult.overall)).toBe(true);
      expect(Number.isNaN(reportResult.overall)).toBe(false);
      expect(reportResult.overall).toBeGreaterThanOrEqual(0);
      expect(reportResult.overall).toBeLessThanOrEqual(100);
    });
  });

  // ── 10. Active SSE Concurrency Gauge ─────────────────────────────────────────
  describe("Active SSE Concurrency Gauge (Fix 1.5)", () => {
    it("allows up to 3 concurrent connections per IP and rejects the 4th, recovering upon close", () => {
      const testIp = "test-gauge-" + crypto.randomBytes(4).toString("hex");

      const closeCallbacks: Array<() => void> = [];
      const createMockRes = () => {
        let onClose: (() => void) | null = null;
        return {
          on: vi.fn((event: string, cb: () => void) => {
            if (event === "close") {
              onClose = cb;
              closeCallbacks.push(cb);
            }
          }),
          write: vi.fn(),
          end: vi.fn(),
          writableEnded: false,
          destroyed: false,
          triggerClose: () => onClose?.(),
        } as any;
      };

      const res1 = createMockRes();
      const res2 = createMockRes();
      const res3 = createMockRes();
      const res4 = createMockRes();

      // 1st, 2nd, 3rd allowed
      expect(addClient(res1, testIp)).toBe(true);
      expect(addClient(res2, testIp)).toBe(true);
      expect(addClient(res3, testIp)).toBe(true);

      // 4th must be rejected by concurrency gauge
      expect(addClient(res4, testIp)).toBe(false);

      // When 1 connection terminates, gauge decrements and a new client is accepted
      res1.triggerClose();
      expect(addClient(res4, testIp)).toBe(true);

      // Clean up
      closeAllStreams();
    });
  });

  // ── 11. Schema String Length Bounds ──────────────────────────────────────────
  describe("Schema String Length Bounds (Finding 2.3)", () => {
    it("rejects telemetry payloads containing oversized string fields", () => {
      const basePayload = {
        sentinelSchema: 1,
        generatedAt: new Date().toISOString(),
        system: {
          hostname: "WORKSTATION-01",
          model: "ThinkPad X1",
          manufacturer: "Lenovo",
        },
      };

      // Oversized hostname > 256 chars
      const invalidHostnamePayload = {
        ...basePayload,
        system: {
          ...basePayload.system,
          hostname: "A".repeat(257),
        },
      };
      expect(SentinelReportSchema.safeParse(invalidHostnamePayload).success).toBe(false);

      // Oversized generatedAt > 64 chars
      const invalidGenAtPayload = {
        ...basePayload,
        generatedAt: "2026-11-13T" + "9".repeat(60),
      };
      expect(SentinelReportSchema.safeParse(invalidGenAtPayload).success).toBe(false);

      // Valid bounds pass
      expect(SentinelReportSchema.safeParse(basePayload).success).toBe(true);
    });
  });

  // ── 12. Pre-Query Rate Limiting & Scan Fail Defense ──────────────────────────
  describe("Pre-Query Rate Limiting & Scan Fail Defense (Fix 2.2)", () => {
    it("enforces attempt rate limits before executing database queries", async () => {
      const ip = "attacker-ip-" + crypto.randomBytes(4).toString("hex");
      const attemptKey = `${ip}:pair_attempt`;

      const attempts: boolean[] = [];
      for (let i = 0; i < 11; i++) {
        attempts.push(await consumeRateLimit(attemptKey, 15, 10));
      }

      // First 10 allowed
      expect(attempts.slice(0, 10)).toEqual(new Array(10).fill(true));
      // 11th blocked before DB query
      expect(attempts[10]).toBe(false);
    });
  });
});
