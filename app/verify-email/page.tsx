import Link from "next/link";
import { verifyEmailWithToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token || "").trim();

  let verified = false;
  let failed = false;

  if (token) {
    try {
      verified = await verifyEmailWithToken(token);
      failed = !verified;
    } catch {
      verified = false;
      failed = true;
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Vérification email</h1>

        {!token ? <p className="error-text">Lien de vérification invalide.</p> : null}
        {token && verified ? (
          <p className="info-text">Email vérifié. Tu peux te connecter.</p>
        ) : null}
        {token && failed ? <p className="error-text">Lien de vérification invalide ou expiré.</p> : null}

        <p className="login-help-link">
          <Link href="/login">Aller à la connexion</Link>
        </p>
      </section>
    </main>
  );
}

