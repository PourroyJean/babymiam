import Link from "next/link";
import { changePasswordAction, logoutEverywhereAction, sendVerificationEmailAction } from "@/app/account/actions";
import { SiteNav } from "@/components/site-nav";
import { getChildProfile } from "@/lib/data";
import { getAccountOverview, requireAuth } from "@/lib/auth";

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function getErrorMessage(code?: string) {
  if (code === "missing_fields") return "Tous les champs sont obligatoires.";
  if (code === "weak_password") return "Le mot de passe doit contenir au moins 8 caractères.";
  if (code === "password_mismatch") return "Les deux mots de passe ne correspondent pas.";
  if (code === "bad_password") return "Mot de passe actuel incorrect.";
  if (code === "unknown") return "Une erreur est survenue. Réessaie plus tard.";
  return null;
}

export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<{
    pw?: string;
    verify_sent?: string;
    already_verified?: string;
    sessions?: string;
    error?: string;
  }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  const childProfile = await getChildProfile(user.id);
  const overview = await getAccountOverview(user.id);

  async function sendVerificationEmailPageAction(formData: FormData) {
    "use server";
    await sendVerificationEmailAction(formData);
  }

  async function changePasswordPageAction(formData: FormData) {
    "use server";
    await changePasswordAction(formData);
  }

  async function logoutEverywherePageAction(formData: FormData) {
    "use server";
    await logoutEverywhereAction(formData);
  }

  const verifiedAt = formatDate(overview?.emailVerifiedAt ?? null);
  const createdAt = formatDate(overview?.createdAt ?? null);
  const errorMessage = getErrorMessage(params.error);

  return (
    <main className="account-page">
      <SiteNav activePage="account" childProfile={childProfile} contextTitle="Compte" />

      <section className="account-grid" aria-label="Paramètres du compte">
        <article className="account-card">
          <h2>Adresse email</h2>
          <p className="account-kv">
            <span>Email</span>
            <strong>{overview?.email || user.email}</strong>
          </p>
          <p className="account-kv">
            <span>Créé</span>
            <strong>{createdAt || "—"}</strong>
          </p>
          <p className="account-kv">
            <span>Vérifié</span>
            <strong>{verifiedAt || "Non"}</strong>
          </p>

          {!overview?.emailVerifiedAt ? (
            <form action={sendVerificationEmailPageAction} className="account-inline-form">
              <button type="submit" className="account-btn">
                Envoyer un lien de vérification
              </button>
            </form>
          ) : null}

          {params.verify_sent ? (
            <p className="info-text account-feedback">
              Si Resend est configuré, un email de vérification vient d&apos;être envoyé.
            </p>
          ) : null}
          {params.already_verified ? (
            <p className="info-text account-feedback">Ton email est déjà vérifié.</p>
          ) : null}
        </article>

        <article className="account-card">
          <h2>Sécurité</h2>
          <p className="account-muted">Change ton mot de passe (8 caractères minimum).</p>

          <form action={changePasswordPageAction} className="account-form">
            <label>
              Mot de passe actuel
              <input
                name="currentPassword"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </label>

            <label>
              Nouveau mot de passe
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

            <button type="submit" className="account-btn">
              Mettre à jour
            </button>
          </form>

          {params.pw ? <p className="info-text account-feedback">Mot de passe mis à jour.</p> : null}
        </article>

        <article className="account-card">
          <h2>Sessions</h2>
          <p className="account-muted">
            Si tu as oublié de te déconnecter ailleurs, tu peux invalider toutes les sessions.
          </p>

          <form action={logoutEverywherePageAction} className="account-inline-form">
            <button type="submit" className="account-btn account-btn-secondary">
              Déconnecter les autres appareils
            </button>
          </form>

          {params.sessions ? (
            <p className="info-text account-feedback">Toutes les sessions ont été réinitialisées.</p>
          ) : null}
        </article>

        <article className="account-card">
          <h2>Aide</h2>
          <p className="account-muted">
            Mot de passe oublié ? <Link href="/forgot-password">Réinitialiser</Link>.
          </p>
          <p className="account-muted">
            Retour au <Link href="/">suivi</Link>.
          </p>
        </article>
      </section>

      {errorMessage ? <p className="error-text account-global-error">{errorMessage}</p> : null}
    </main>
  );
}
