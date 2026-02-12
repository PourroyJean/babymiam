import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { loginAction } from "@/app/login/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect("/");
  }
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Babymiam</h1>
        <p>Connecte-toi pour suivre la diversification de bébé.</p>

        <form action={loginAction} className="login-form">
          <label>
            Identifiant
            <input name="username" type="text" placeholder="LJCLS" required />
          </label>

          <label>
            Mot de passe
            <input name="password" type="password" placeholder="••••••••" required />
          </label>

          <button type="submit">Se connecter</button>
        </form>

        {params.error ? (
          <p className="error-text">Identifiant ou mot de passe incorrect.</p>
        ) : null}
      </section>
    </main>
  );
}
