import Link from "next/link";
import { resetPasswordAction } from "@/app/reset-password/actions";

function getErrorMessage(code?: string) {
  if (code === "weak_password") {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }

  if (code === "password_mismatch") {
    return "Les deux mots de passe ne correspondent pas.";
  }

  if (code === "invalid_token") {
    return "Le lien de réinitialisation est invalide ou expiré.";
  }

  return null;
}

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token || "").trim();
  const errorMessage = getErrorMessage(params.error);

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Réinitialiser le mot de passe</h1>

        {token ? (
          <form action={resetPasswordAction} className="login-form">
            <input type="hidden" name="token" value={token} />

            <label>
              Nouveau mot de passe
              <input name="password" type="password" placeholder="••••••••" required minLength={8} />
            </label>

            <label>
              Confirmer le mot de passe
              <input name="confirmPassword" type="password" placeholder="••••••••" required minLength={8} />
            </label>

            <button type="submit">Mettre à jour</button>
          </form>
        ) : (
          <p className="error-text">Lien de réinitialisation invalide.</p>
        )}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <p className="login-help-link">
          <Link href="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  );
}
