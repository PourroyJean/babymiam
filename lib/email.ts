import { Resend } from "resend";

let resendClient: Resend | null = null;
export type EmailConfigError = "missing_resend_api_key" | "missing_mail_from";
type EmailTransport =
  | { ok: true; client: Resend; from: string }
  | { ok: false; error: EmailConfigError };
export type EmailDeliveryResult = { ok: true } | { ok: false; error: EmailConfigError };

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getMailFrom() {
  const mailFrom = process.env.MAIL_FROM?.trim();
  return mailFrom || null;
}

function getEmailClientAndSender(): EmailTransport {
  const client = getResendClient();
  if (!client) {
    return { ok: false, error: "missing_resend_api_key" };
  }

  const from = getMailFrom();
  if (!from) {
    return { ok: false, error: "missing_mail_from" };
  }

  return { ok: true, client, from };
}

function reportEmailConfigError(error: EmailConfigError, type: "password reset" | "email verification") {
  if (error === "missing_resend_api_key") {
    console.error(`[email] RESEND_API_KEY is missing; ${type} email skipped.`);
    return;
  }

  console.error(`[email] MAIL_FROM is missing; ${type} email skipped.`);
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }): Promise<EmailDeliveryResult> {
  const emailClient = getEmailClientAndSender();
  if (!emailClient.ok) {
    reportEmailConfigError(emailClient.error, "password reset");
    return { ok: false, error: emailClient.error };
  }

  await emailClient.client.emails.send({
    from: emailClient.from,
    to: params.to,
    subject: "Réinitialisation de votre mot de passe Grrrignote",
    text: [
      "Vous avez demandé une réinitialisation de mot de passe.",
      "",
      `Ouvrir ce lien: ${params.resetUrl}`,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
    ].join("\n")
  });
  return { ok: true };
}

export async function sendEmailVerificationEmail(params: {
  to: string;
  verifyUrl: string;
}): Promise<EmailDeliveryResult> {
  const emailClient = getEmailClientAndSender();
  if (!emailClient.ok) {
    reportEmailConfigError(emailClient.error, "email verification");
    return { ok: false, error: emailClient.error };
  }

  await emailClient.client.emails.send({
    from: emailClient.from,
    to: params.to,
    subject: "Confirme ton email sur Grrrignote",
    text: [
      "Bienvenue sur Grrrignote !",
      "",
      "Confirme ton adresse email en ouvrant ce lien:",
      params.verifyUrl,
      "",
      "Si tu n'es pas à l'origine de cette demande, ignore cet email."
    ].join("\n")
  });
  return { ok: true };
}
