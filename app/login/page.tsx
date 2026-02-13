import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { loginAction } from "@/app/login/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect("/");
  }
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Grrrignote</h1>
        <p>Connecte-toi pour suivre la diversification de bébé.</p>

        <form action={loginAction} className="login-form">
          <label>
            Email
            <input name="email" type="email" placeholder="parent@example.com" required />
          </label>

          <label>
            Mot de passe
            <input name="password" type="password" placeholder="••••••••" required />
          </label>

          <button type="submit">Se connecter</button>
        </form>

        <p className="login-help-link">
          <a href="/forgot-password">Mot de passe oublié ?</a>
        </p>

        {params.error ? (
          <p className="error-text">Email ou mot de passe incorrect.</p>
        ) : null}
        {params.reset ? <p className="info-text">Mot de passe mis à jour. Connecte-toi.</p> : null}
      </section>
    </main>
  );
}
