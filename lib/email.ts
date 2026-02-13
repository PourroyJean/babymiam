import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getMailFrom() {
  return process.env.MAIL_FROM?.trim() || "Babymiam <no-reply@babymiam.local>";
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  const client = getResendClient();

  if (!client) {
    console.warn("[email] RESEND_API_KEY is missing; password reset email skipped.");
    return;
  }

  await client.emails.send({
    from: getMailFrom(),
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
}
