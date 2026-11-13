import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import {
  db,
  myReportsSessionsTable,
  usersTable,
  organizationsTable,
  organizationMembersTable,
} from "@workspace/db";

export interface TenantContext {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "member" | "viewer" | string;
}

export interface TenantRequest extends Request {
  tenant: TenantContext;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Middleware ensuring an active tenant context exists from either:
 * 1. __Host-sentinel_session or sentinel_session cookie (browser sessions)
 * 2. X-Sentinel-Org-Key header (SHA-256 hashed organization API keys)
 *
 * Populates `req.tenant = { userId, orgId, role }`.
 */
export async function requireTenantAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check API Key header
    const rawApiKey = req.headers["x-sentinel-org-key"] || req.headers["x-sentinel-api-key"];
    const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : Array.isArray(rawApiKey) ? rawApiKey[0]?.trim() : undefined;

    if (apiKey && apiKey.length >= 16) {
      const keyHash = hashToken(apiKey);
      const orgs = await db
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.apiKeyHash, keyHash))
        .limit(1);

      const org = orgs[0];
      if (org) {
        req.tenant = {
          userId: org.ownerId,
          orgId: org.id,
          role: "admin",
        };
        next();
        return;
      }
    }

    // 2. Check Session Cookie
    const cookies = req.cookies as Record<string, string> | undefined;
    const sessionToken = cookies?.["__Host-sentinel_session"] || cookies?.["sentinel_session"];

    if (sessionToken && sessionToken.length >= 16) {
      const sessionHash = hashToken(sessionToken);
      const now = new Date();

      const sessionRows = await db
        .select()
        .from(myReportsSessionsTable)
        .where(
          and(
            eq(myReportsSessionsTable.token, sessionHash),
            gt(myReportsSessionsTable.expiresAt, now)
          )
        )
        .limit(1);

      const session = sessionRows[0];
      if (session) {
        const userRows = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, session.email))
          .limit(1);

        const user = userRows[0];
        if (user) {
          const requestedOrgId = typeof req.headers["x-organization-id"] === "string" ? req.headers["x-organization-id"] : undefined;

          // Check membership
          const memberships = await db
            .select()
            .from(organizationMembersTable)
            .where(eq(organizationMembersTable.userId, user.id));
          const matchedMembership = requestedOrgId
            ? memberships.find((m) => m.orgId === requestedOrgId)
            : memberships[0];

          if (matchedMembership) {
            req.tenant = {
              userId: user.id,
              orgId: matchedMembership.orgId,
              role: matchedMembership.role,
            };
            next();
            return;
          }

          // Check owned organizations
          const ownedOrgs = await db
            .select()
            .from(organizationsTable)
            .where(eq(organizationsTable.ownerId, user.id));

          const matchedOrg = requestedOrgId
            ? ownedOrgs.find((o) => o.id === requestedOrgId)
            : ownedOrgs[0];

          if (matchedOrg) {
            req.tenant = {
              userId: user.id,
              orgId: matchedOrg.id,
              role: "owner",
            };
            next();
            return;
          }
        }
      }
    }

    res.status(401).json({
      error: "Authentication required",
      details: "Valid session cookie or X-Sentinel-Org-Key header is required to access organization resources.",
    });
  } catch (err) {
    req.log?.error?.({ err }, "requireTenantAuth error");
    res.status(500).json({ error: "Internal server error during authentication" });
  }
}
