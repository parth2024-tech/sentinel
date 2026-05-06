import { getPublicSiteOrigin } from "../../githubReleaseRepo";

export function buildMagicLinkVerifyUrl(token: string): string {
  const origin = getPublicSiteOrigin();
  const path = `/api/my-reports/verify?token=${encodeURIComponent(token)}`;
  return `${origin}${path}`;
}

export function buildReportPublicUrl(reportId: string): string {
  const origin = getPublicSiteOrigin();
  return `${origin}/r/${encodeURIComponent(reportId)}`;
}
