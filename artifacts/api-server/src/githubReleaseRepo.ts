/**
 * GitHub org/repo used to resolve Sentinel release assets.
 *
 * - `SENTINEL_GITHUB_REPO` — explicit override (e.g. `owner/repo`)
 * - `GITHUB_REPOSITORY` — set automatically in GitHub Actions
 * - Default — matches this monorepo (native installers publish here)
 */
export function getGithubReleaseRepo(): string {
  const explicit = process.env.SENTINEL_GITHUB_REPO?.trim();
  if (explicit) return explicit;

  const fromCi = process.env.GITHUB_REPOSITORY?.trim();
  if (fromCi) return fromCi;

  return "parth2024-tech/Marketing-Website-Plan";
}

/** Site origin for absolute links returned by the API (e.g. version downloadUrl). */
export function getPublicSiteOrigin(): string {
  return (process.env.SENTINEL_PUBLIC_BASE_URL ?? "https://sentinelapp.io").replace(
    /\/$/,
    ""
  );
}
