import { buildMagicLinkVerifyUrl } from "../urls";
import {
  MAGIC_LINK_REMINDER_LEAD_MIN,
  MAGIC_LINK_TTL_MIN,
} from "../../magicLinkConstants";

export type MagicLinkEmailKind = "login" | "reminder";

export function buildMagicLinkLoginEmail(
  token: string,
  kind: MagicLinkEmailKind
): { subject: string; html: string; text: string } {
  const url = buildMagicLinkVerifyUrl(token);
  const isReminder = kind === "reminder";

  const subject = isReminder
    ? `Your Sentinel sign-in link expires in about ${MAGIC_LINK_REMINDER_LEAD_MIN} minutes`
    : "Sign in to Sentinel — your magic link";

  const lead = isReminder
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#cbd5e1">Your one-time sign-in link for <strong>My Reports</strong> will expire soon. Click the button below to finish signing in.</p>`
    : `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#cbd5e1">Use this one-time link to open <strong>My Reports</strong> and see hardware reports tied to your email. This link expires in <strong>${MAGIC_LINK_TTL_MIN} minutes</strong>.</p>`;

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#0a0e1a;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto">
      <tr>
        <td style="padding:24px;border-radius:12px;background:#111827;border:1px solid rgba(34,211,238,0.25)">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee">Sentinel</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#f8fafc">${isReminder ? "Link expiring soon" : "Sign in to My Reports"}</h1>
          ${lead}
          <p style="margin:24px 0">
            <a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#22d3ee;color:#0f172a;font-weight:600;text-decoration:none">${isReminder ? "Sign in now" : "Open My Reports"}</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8">If the button does not work, paste this URL into your browser:<br /><span style="word-break:break-all;color:#67e8f9">${url}</span></p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = isReminder
    ? `Your Sentinel My Reports sign-in link expires soon.\n\nOpen this URL to sign in:\n${url}\n`
    : `Sign in to Sentinel My Reports (link expires in ${MAGIC_LINK_TTL_MIN} minutes):\n\n${url}\n`;

  return { subject, html, text };
}
