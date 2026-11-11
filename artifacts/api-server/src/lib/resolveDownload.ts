import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getGithubReleaseRepo } from "../githubReleaseRepo.js";

export type DownloadSlug = "oneshot" | "setup" | "agent";

export const DOWNLOAD_SLUGS: DownloadSlug[] = ["oneshot", "setup", "agent"];

/** Stable slug → release asset file name */
export const ASSET_FILENAMES: Record<DownloadSlug, string> = {
  oneshot: "SentinelOneShot.exe",
  setup: "SentinelSetup.msi",
  agent: "SentinelAgent.exe",
};

export type DownloadResolution =
  | { kind: "file"; filePath: string; filename: string; source: "local" }
  | { kind: "redirect"; url: string; source: "env" | "github" };

function repoRootFromModule(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Robustly walk up to find the workspace root containing pnpm-workspace.yaml
  let current = here;
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return path.resolve(here, "..", "..", "..", "..");
}

export function getDownloadsDirectory(): string {
  const configured = process.env.SENTINEL_DOWNLOADS_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(repoRootFromModule(), "artifacts", "downloads");
}

function envUrlForSlug(slug: DownloadSlug): string | undefined {
  const key = `SENTINEL_DOWNLOAD_URL_${slug.toUpperCase()}`;
  const value = process.env[key]?.trim();
  return value || undefined;
}

function githubAuthHeaders(): Record<string, string> {
  const token =
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.SENTINEL_GITHUB_TOKEN?.trim();

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "SentinelAPI/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type GhAsset = { name: string; browser_download_url: string };
type GhRelease = {
  tag_name: string;
  draft: boolean;
  assets: GhAsset[];
};

let cachedReleases: GhRelease[] | null = null;
let releasesLastFetched = 0;
const RELEASES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let inflightReleasesPromise: Promise<GhRelease[] | null> | null = null;

async function fetchGithubReleases(): Promise<GhRelease[] | null> {
  const repo = getGithubReleaseRepo();
  const headers = githubAuthHeaders();
  const listUrl = `https://api.github.com/repos/${repo}/releases?per_page=30`;

  try {
    const listRes = await fetch(listUrl, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });

    if (!listRes.ok) {
      return null;
    }

    return (await listRes.json()) as GhRelease[];
  } catch {
    return null;
  }
}

async function getCachedGithubReleases(): Promise<GhRelease[] | null> {
  const now = Date.now();
  if (cachedReleases && now - releasesLastFetched < RELEASES_CACHE_TTL_MS) {
    return cachedReleases;
  }

  if (inflightReleasesPromise) {
    return inflightReleasesPromise;
  }

  inflightReleasesPromise = fetchGithubReleases()
    .then((releases) => {
      if (releases) {
        cachedReleases = releases;
        releasesLastFetched = Date.now();
      }
      return releases ?? cachedReleases;
    })
    .finally(() => {
      inflightReleasesPromise = null;
    });

  return inflightReleasesPromise;
}

async function findAssetOnGithub(
  assetName: string
): Promise<{ url: string; tag: string } | null> {
  const releases = await getCachedGithubReleases();
  if (!releases) {
    return null;
  }
  for (const release of releases) {
    if (release.draft) continue;
    const asset = release.assets.find(
      (a) => a.name.toLowerCase() === assetName.toLowerCase()
    );
    if (asset?.browser_download_url) {
      return { url: asset.browser_download_url, tag: release.tag_name };
    }
  }

  return null;
}

/**
 * Resolve a download slug to a local file path or remote URL.
 * Priority: explicit env URL → bundled local file → GitHub Releases (any release).
 */
export async function resolveDownload(
  slug: DownloadSlug
): Promise<DownloadResolution | null> {
  const filename = ASSET_FILENAMES[slug];

  const envUrl = envUrlForSlug(slug);
  if (envUrl) {
    return { kind: "redirect", url: envUrl, source: "env" };
  }

  const localPath = path.join(getDownloadsDirectory(), filename);
  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    return { kind: "file", filePath: localPath, filename, source: "local" };
  }

  const gh = await findAssetOnGithub(filename);
  if (gh) {
    return { kind: "redirect", url: gh.url, source: "github" };
  }

  return null;
}

export function isDownloadSlug(value: string): value is DownloadSlug {
  return (DOWNLOAD_SLUGS as string[]).includes(value);
}

export function unavailableMessage(slug: DownloadSlug): string {
  const filename = ASSET_FILENAMES[slug];
  const repo = getGithubReleaseRepo();
  return (
    `${filename} is not available yet. ` +
    `Publish a release on GitHub (${repo}) with ${filename} attached, ` +
    `or configure SENTINEL_DOWNLOAD_URL_${slug.toUpperCase()}.`
  );
}
