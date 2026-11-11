/**
 * GitHub org/repo used to resolve Sentinel release assets.
 *
 * - `SENTINEL_GITHUB_REPO` — explicit override (e.g. `owner/repo`)
 * - `GITHUB_REPOSITORY` — set automatically in GitHub Actions
 * - Default — matches this monorepo (native installers publish here)
 */
const DEFAULT_REPO = "parth2024-tech/Marketing-Website-Plan";
const REPO_REGEX = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function getGithubReleaseRepo(): string {
  const explicit = process.env.SENTINEL_GITHUB_REPO?.trim();
  if (explicit && REPO_REGEX.test(explicit)) return explicit;

  const fromCi = process.env.GITHUB_REPOSITORY?.trim();
  if (fromCi && REPO_REGEX.test(fromCi)) return fromCi;

  return DEFAULT_REPO;
}

/** Site origin for absolute links returned by the API (e.g. version downloadUrl). */
export function getPublicSiteOrigin(): string {
  const origin = (process.env.SENTINEL_PUBLIC_BASE_URL ?? "https://sentinelapp.io").replace(
    /\/$/,
    ""
  );
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return "https://sentinelapp.io";
  }
}
