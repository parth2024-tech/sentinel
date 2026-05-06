import { Router, Request, Response } from "express";
import { getGithubReleaseRepo, getPublicSiteOrigin } from "../githubReleaseRepo.js";

const router = Router();

// In-memory cache to avoid hammering GitHub API on every agent check-in
let versionCache: { data: any; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

router.get("/", async (_req: Request, res: Response) => {
  const now = Date.now();

  // Return cached response if fresh
  if (versionCache && now - versionCache.fetchedAt < CACHE_TTL_MS) {
    res.json(versionCache.data);
    return;
  }

  const GITHUB_REPO = getGithubReleaseRepo();

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "SentinelAPI/1.0",
        },
      }
    );

    if (ghResponse.ok) {
      const release = (await ghResponse.json()) as {
        tag_name: string;
      };

      // Strip leading 'v' from tag (v1.0.0 → 1.0.0)
      const latestVersion = release.tag_name.replace(/^v/, "");

      const origin = getPublicSiteOrigin();
      const data = {
        minVersion: "1.0.0",
        latestVersion,
        downloadUrl: `${origin}/api/downloads/latest/setup`,
      };

      versionCache = { data, fetchedAt: now };
      res.json(data);
      return;
    }
  } catch (err) {
    console.error("Failed to fetch latest release for version check:", err);
  }

  // Fallback if GitHub API is unreachable
  const origin = getPublicSiteOrigin();
  const fallback = {
    minVersion: "1.0.0",
    latestVersion: "1.0.0",
    downloadUrl: `${origin}/get-started`,
  };

  res.json(fallback);
});

export default router;
