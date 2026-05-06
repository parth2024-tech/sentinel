import { buildReportPublicUrl } from "../urls";

export function buildReportClaimedEmail(
  email: string,
  reportId: string
): { subject: string; html: string; text: string } {
  const reportUrl = buildReportPublicUrl(reportId);
  const subject = "Your Sentinel report is claimed";

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#0a0e1a;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto">
      <tr>
        <td style="padding:24px;border-radius:12px;background:#111827;border:1px solid rgba(34,211,238,0.25)">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#22d3ee">Sentinel</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#f8fafc">Report linked to your account</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#cbd5e1">We've linked hardware report <strong style="color:#f8fafc;font-family:ui-monospace,monospace">${reportId}</strong> to <strong style="color:#f8fafc">${escapeHtml(email)}</strong>. You can open it anytime while signed in to My Reports.</p>
          <p style="margin:24px 0">
            <a href="${reportUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#22d3ee;color:#0f172a;font-weight:600;text-decoration:none">View report</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8">Direct link:<br /><span style="word-break:break-all;color:#67e8f9">${reportUrl}</span></p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Your Sentinel report ${reportId} has been claimed and linked to ${email}.\n\nView it here:\n${reportUrl}\n`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
