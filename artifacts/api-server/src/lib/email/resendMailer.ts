import { Resend } from "resend";
import { getResendApiKey, getResendFromAddress } from "./config";

let client: Resend | null = null;

export function getResendClient(): Resend {
  const key = getResendApiKey();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!client) {
    client = new Resend(key);
  }
  return client;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getResendFromAddress(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error("Resend returned no email id");
  }
}
