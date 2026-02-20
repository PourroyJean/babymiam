import Link from "next/link";
import { verifyEmailAction } from "@/app/verify-email/actions";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token || "").trim();
  const status = String(params.status || "").trim().toLowerCase();
  const isSuccess = status === "success";
  const isInvalid = status === "invalid";
  const canSubmit = Boolean(token) && !isSuccess && !isInvalid;

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Vérification email</h1>

        {!token && !isSuccess && !isInvalid ? <p className="error-text">Lien de vérification invalide.</p> : null}
        {canSubmit ? (
          <form action={verifyEmailAction} className="login-form">
            <input type="hidden" name="token" value={token} />
            <button type="submit">Confirmer mon email</button>
          </form>
        ) : null}
        {isSuccess ? (
          <p className="info-text">Email vérifié. Tu peux te connecter.</p>
        ) : null}
        {isInvalid ? <p className="error-text">Lien de vérification invalide ou expiré.</p> : null}

        <p className="login-help-link">
          <Link href="/login">Aller à la connexion</Link>
        </p>
      </section>
    </main>
  );
}
