import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/app/signup/actions";
import { isAuthenticated } from "@/lib/auth";

function getErrorMessage(code?: string) {
  if (code === "invalid_email") {
    return "Renseigne un email valide.";
  }

  if (code === "weak_password") {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }

  if (code === "password_mismatch") {
    return "Les deux mots de passe ne correspondent pas.";
  }

  if (code === "email_in_use") {
    return "Cet email est déjà utilisé. Connecte-toi ou réinitialise ton mot de passe.";
  }

  if (code === "rate_limited") {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }

  if (code === "unknown") {
    return "Impossible de créer le compte. Réessaie plus tard.";
  }

  return null;
}

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect("/");
  }

  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Créer un compte</h1>
        <p>Crée ton compte pour commencer le suivi.</p>

        <form action={signupAction} className="login-form">
          <label>
            Email
            <input name="email" type="email" placeholder="parent@example.com" required />
          </label>

          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>

          <label>
            Confirmer le mot de passe
            <input
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>

          <button type="submit">Créer mon compte</button>
        </form>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <p className="login-help-link">
          <Link href="/login">Déjà un compte ? Se connecter</Link>
        </p>
      </section>
    </main>
  );
}

