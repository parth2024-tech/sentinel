/**
 * Resend + outbound email configuration.
 *
 * Production: set `RESEND_API_KEY` and a verified-domain `RESEND_FROM_EMAIL`
 * (e.g. `Sentinel <reports@yourdomain.com>`). For Resend onboarding only,
 * you may use their test sender until your domain is verified.
 */
export function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || undefined;
}

export function getResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Sentinel <onboarding@resend.dev>"
  );
}

export function isResendConfigured(): boolean {
  return Boolean(getResendApiKey());
}
