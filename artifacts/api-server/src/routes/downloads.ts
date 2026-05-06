import { Router, Request, Response } from "express";
import { getGithubReleaseRepo } from "../githubReleaseRepo.js";
import {
  ASSET_FILENAMES,
  DOWNLOAD_SLUGS,
  getDownloadsDirectory,
  isDownloadSlug,
  resolveDownload,
  unavailableMessage,
  type DownloadSlug,
} from "../lib/resolveDownload.js";

const router = Router();

/**
 * Stable download endpoints — the website links here, never to a pinned version.
 *
 *   GET /api/downloads/latest/oneshot  → SentinelOneShot.exe
 *   GET /api/downloads/latest/setup    → SentinelSetup.msi
 *   GET /api/downloads/latest/agent    → SentinelAgent.exe
 *
 * Resolution order: env URL override → artifacts/downloads → GitHub Releases.
 */

router.get("/latest/:binary", async (req: Request, res: Response) => {
  const raw = req.params.binary;
  const slugParam = Array.isArray(raw) ? raw[0] : raw;
  const slug = typeof slugParam === "string" ? slugParam.toLowerCase() : "";

  if (!isDownloadSlug(slug)) {
    const label =
      typeof slugParam === "string"
        ? slugParam
        : Array.isArray(raw)
          ? raw.join(",")
          : String(raw ?? "");
    res.status(404).json({
      error: `Unknown binary "${label}". Valid options: ${DOWNLOAD_SLUGS.join(", ")}`,
    });
    return;
  }

  try {
    const resolved = await resolveDownload(slug);

    if (!resolved) {
      res.status(503).json({
        error: unavailableMessage(slug),
        slug,
        filename: ASSET_FILENAMES[slug],
        releasesUrl: `https://github.com/${getGithubReleaseRepo()}/releases`,
      });
      return;
    }

    if (resolved.kind === "file") {
      res.setHeader("X-Sentinel-Download-Source", resolved.source);
      res.setHeader("X-Sentinel-Version", "1.0.0");
      res.download(resolved.filePath, resolved.filename);
      return;
    }

    res.setHeader("X-Sentinel-Download-Source", resolved.source);
    res.redirect(302, resolved.url);
  } catch (err) {
    console.error(`Failed to resolve download for "${slug}":`, err);
    res.status(503).json({
      error: unavailableMessage(slug as DownloadSlug),
      slug,
    });
  }
});

/**
 * GET /api/downloads/latest
 * Returns metadata about available downloads (local + GitHub).
 */
router.get("/latest", async (_req: Request, res: Response) => {
  const GITHUB_REPO = getGithubReleaseRepo();
  const downloadsDir = getDownloadsDirectory();

  const assets: Array<{
    slug: DownloadSlug;
    name: string;
    available: boolean;
    source: string | null;
    downloadUrl: string;
  }> = [];

  for (const slug of DOWNLOAD_SLUGS) {
    const resolved = await resolveDownload(slug);
    assets.push({
      slug,
      name: ASSET_FILENAMES[slug],
      available: resolved !== null,
      source: resolved?.source ?? null,
      downloadUrl: `/api/downloads/latest/${slug}`,
    });
  }

  res.json({
    version: null,
    name: "Sentinel native downloads",
    publishedAt: null,
    releaseUrl: `https://github.com/${GITHUB_REPO}/releases`,
    downloadsDirectory: downloadsDir,
    assets,
  });
});

export default router;
