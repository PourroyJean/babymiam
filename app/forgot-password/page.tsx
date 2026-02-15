import { redirect } from "next/navigation";
import { forgotPasswordAction } from "@/app/forgot-password/actions";
import { isAuthenticated } from "@/lib/auth";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Mot de passe oublié</h1>
        <p>Renseigne ton email pour recevoir un lien de réinitialisation.</p>

        <form action={forgotPasswordAction} className="login-form">
          <label>
            Email
            <input name="email" type="email" placeholder="parent@example.com" required />
          </label>

          <button type="submit">Envoyer le lien</button>
        </form>

        {params.sent ? (
          <p className="info-text">
            Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.
          </p>
        ) : null}

        <p className="login-help-link">
          <a href="/login">Retour à la connexion</a>
        </p>
        <p className="login-help-link">
          <a href="/signup">Créer un compte</a>
        </p>
      </section>
    </main>
  );
}
