"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutAction, saveChildProfileAction } from "@/app/actions";
import {
  changePasswordAction,
  generatePublicShareLinkAction,
  getAccountOverviewAction,
  logoutEverywhereAction,
  regeneratePublicShareLinkAction,
  sendVerificationEmailAction
} from "@/app/account/actions";
import { getClientTimezoneOffsetMinutes, getCurrentIsoDate } from "@/lib/date-utils";
import type { AccountPublicShareLink, ChildProfile, ProgressSummary } from "@/lib/types";

type ProfileMenuProps = {
  initialProfile: ChildProfile | null;
  progressSummary?: ProgressSummary | null;
};

type FeedbackTone = "success" | "error" | "info";

type GetAccountOverviewOkResult = Extract<
  Awaited<ReturnType<typeof getAccountOverviewAction>>,
  { ok: true }
>;

type AccountOverviewDTO = NonNullable<GetAccountOverviewOkResult["overview"]>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHARE_FEEDBACK_TIMEOUT_MS = 3200;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function copyWithExecCommand(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  document.body.removeChild(textarea);
  return didCopy;
}

function formatAccountDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function formatShareExpiryDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function truncateShareUrl(value: string, maxLength = 58) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;

  const prefixLength = Math.max(24, Math.floor((maxLength - 1) * 0.64));
  const suffixLength = Math.max(12, maxLength - prefixLength - 1);
  return `${normalized.slice(0, prefixLength)}…${normalized.slice(-suffixLength)}`;
}

function getAccountErrorMessage(code?: string) {
  if (code === "missing_fields") return "Tous les champs sont obligatoires.";
  if (code === "weak_password") return "Le mot de passe doit contenir au moins 8 caractères.";
  if (code === "password_mismatch") return "Les deux mots de passe ne correspondent pas.";
  if (code === "bad_password") return "Mot de passe actuel incorrect.";
  if (code === "email_unavailable") return "Le service email est temporairement indisponible. Réessaie plus tard.";
  if (code === "unknown") return "Une erreur est survenue. Réessaie plus tard.";
  return "Une erreur est survenue.";
}

export function ProfileMenu({ initialProfile, progressSummary = null }: ProfileMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();
  const [profileErrorMessage, setProfileErrorMessage] = useState("");
  const [publicShareActionMode, setPublicShareActionMode] = useState<null | "generate" | "regenerate">(null);
  const [shareFeedback, setShareFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  const [publicShareLink, setPublicShareLink] = useState<AccountPublicShareLink | null>(null);
  const shareFeedbackTimeoutRef = useRef<number | null>(null);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const [accountUserEmail, setAccountUserEmail] = useState("");
  const [accountOverview, setAccountOverview] = useState<AccountOverviewDTO | null>(null);
  const [accountLoadError, setAccountLoadError] = useState("");
  const [accountFeedback, setAccountFeedback] = useState<{
    tone: FeedbackTone;
    message: string;
  } | null>(null);
  const accountLoadedRef = useRef(false);
  const accountLoadingRef = useRef(false);

  const initialFirstName = initialProfile?.firstName ?? "";
  const initialBirthDate = initialProfile?.birthDate ?? "";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);

  useEffect(() => {
    if (!isOpen) {
      setFirstName(initialFirstName);
      setBirthDate(initialBirthDate);
      setProfileErrorMessage("");
      setShareFeedback(null);
      setPublicShareActionMode(null);
      setIsLogoutConfirmOpen(false);
      setAccountLoadError("");
      setAccountFeedback(null);
    }
  }, [initialFirstName, initialBirthDate, isOpen]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (shareFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(shareFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const isDirty = firstName.trim() !== initialFirstName || birthDate !== initialBirthDate;

  const isValid = useMemo(() => {
    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) return false;
    if (!isValidIsoDate(birthDate)) return false;
    return birthDate <= getCurrentIsoDate();
  }, [firstName, birthDate]);

  const shareSnapshot = useMemo(
    () => ({
      introducedCount: progressSummary?.introducedCount ?? 0,
      totalFoods: progressSummary?.totalFoods ?? 0,
      likedCount: progressSummary?.likedCount ?? 0,
      recentFoodNames: (progressSummary?.recentFoodNames ?? []).slice(0, 3)
    }),
    [progressSummary]
  );

  const isSummaryAvailable = progressSummary !== null;

  const ensureAccountLoaded = useCallback(() => {
    if (accountLoadedRef.current || accountLoadingRef.current) return;
    accountLoadingRef.current = true;
    setAccountLoadError("");

    startAccountTransition(async () => {
      try {
        const result = await getAccountOverviewAction();
        if (!result.ok) {
          setAccountLoadError("Impossible de charger les infos du compte.");
          accountLoadedRef.current = false;
          return;
        }

        accountLoadedRef.current = true;
        setAccountUserEmail(result.userEmail);
        setAccountOverview(result.overview);
        setPublicShareLink(result.publicShareLink);
      } catch {
        setAccountLoadError("Impossible de charger les infos du compte.");
        accountLoadedRef.current = false;
      } finally {
        accountLoadingRef.current = false;
      }
    });
  }, [startAccountTransition]);

  useEffect(() => {
    if (!isOpen) return;
    ensureAccountLoaded();
  }, [ensureAccountLoaded, isOpen]);

  function showShareFeedback(tone: FeedbackTone, message: string) {
    if (shareFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(shareFeedbackTimeoutRef.current);
    }

    setShareFeedback({ tone, message });
    shareFeedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null);
      shareFeedbackTimeoutRef.current = null;
    }, SHARE_FEEDBACK_TIMEOUT_MS);
  }

  function showAccountFeedback(tone: FeedbackTone, message: string) {
    setAccountFeedback({ tone, message });
  }

  async function onSendVerificationEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountFeedback(null);
    setAccountLoadError("");

    const formData = new FormData(event.currentTarget);

    startAccountTransition(async () => {
      try {
        const result = await sendVerificationEmailAction(formData);
        if (!result.ok) {
          showAccountFeedback("error", getAccountErrorMessage(result.error));
          return;
        }

        if (result.status === "already_verified") {
          showAccountFeedback("info", "Ton email est déjà vérifié.");
          return;
        }

        showAccountFeedback("success", "Email de vérification envoyé.");
      } catch {
        showAccountFeedback("error", getAccountErrorMessage("unknown"));
      }
    });
  }

  async function onChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountFeedback(null);
    setAccountLoadError("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    startAccountTransition(async () => {
      try {
        const result = await changePasswordAction(formData);
        if (!result.ok) {
          showAccountFeedback("error", getAccountErrorMessage(result.error));
          return;
        }

        form.reset();
        showAccountFeedback("success", "Mot de passe mis à jour.");
      } catch {
        showAccountFeedback("error", getAccountErrorMessage("unknown"));
      }
    });
  }

  async function onLogoutEverywhere(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountFeedback(null);
    setAccountLoadError("");

    const formData = new FormData(event.currentTarget);

    startAccountTransition(async () => {
      try {
        const result = await logoutEverywhereAction(formData);
        if (!result.ok) {
          showAccountFeedback("error", getAccountErrorMessage(result.error));
          return;
        }

        showAccountFeedback("success", "Toutes les sessions ont été réinitialisées.");
      } catch {
        showAccountFeedback("error", getAccountErrorMessage("unknown"));
      }
    });
  }

  async function onCopyPublicShareLink() {
    if (!publicShareLink) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicShareLink.url);
        showShareFeedback("success", "Lien copié.");
        return;
      }

      if (copyWithExecCommand(publicShareLink.url)) {
        showShareFeedback("success", "Lien copié.");
        return;
      }

      showShareFeedback("error", "Impossible de copier le lien pour le moment.");
    } catch {
      showShareFeedback("error", "Impossible de copier le lien pour le moment.");
    }
  }

  async function onGeneratePublicShareLink() {
    if (publicShareActionMode !== null) return;

    setPublicShareActionMode("generate");

    try {
      const result = await generatePublicShareLinkAction();
      if (!result.ok) {
        showShareFeedback("error", "Impossible de générer le lien public.");
        return;
      }

      setPublicShareLink(result.publicShareLink);
      showShareFeedback("success", "Lien public généré.");
    } catch {
      showShareFeedback("error", "Impossible de générer le lien public.");
    } finally {
      setPublicShareActionMode(null);
    }
  }

  async function onRegeneratePublicShareLink() {
    if (publicShareActionMode !== null) return;

    setPublicShareActionMode("regenerate");

    try {
      const result = await regeneratePublicShareLinkAction();
      if (!result.ok) {
        showShareFeedback("error", "Impossible de régénérer le lien public.");
        return;
      }

      setPublicShareLink(result.publicShareLink);
      showShareFeedback("success", "Lien public régénéré.");
    } catch {
      showShareFeedback("error", "Impossible de régénérer le lien public.");
    } finally {
      setPublicShareActionMode(null);
    }
  }

  function onClose() {
    setIsOpen(false);
  }

  function onSave() {
    if (!isDirty || !isValid) return;

    const formData = new FormData();
    formData.set("firstName", firstName.trim());
    formData.set("birthDate", birthDate);
    formData.set("tzOffsetMinutes", String(getClientTimezoneOffsetMinutes()));

    startProfileTransition(async () => {
      const result = await saveChildProfileAction(formData);
      if (!result.ok) {
        setProfileErrorMessage(result.error || "Impossible d'enregistrer le profil.");
        return;
      }

      setProfileErrorMessage("");
      setIsOpen(false);
      router.refresh();
    });
  }

  const isAccountEmailVerified = Boolean(accountOverview?.emailVerifiedAt);
  const isUiBusy = isAccountPending || isProfilePending;

  function renderShareSection() {
    const isGeneratingLink = publicShareActionMode === "generate";
    const isRegeneratingLink = publicShareActionMode === "regenerate";
    const hasLoadedAccount = accountOverview !== null;

    return (
      <section className="profile-progress-section" aria-label="Lien public de partage">
        <h3>Lien grands-parents</h3>

        {isSummaryAvailable ? (
          <p className="profile-progress-stats">
            {shareSnapshot.introducedCount}/{shareSnapshot.totalFoods} aliments testés • {shareSnapshot.likedCount}{" "}
            appréciés
          </p>
        ) : null}

        {isSummaryAvailable ? (
          shareSnapshot.recentFoodNames.length > 0 ? (
            <p className="profile-progress-recent">Derniers essais: {shareSnapshot.recentFoodNames.join(", ")}</p>
          ) : (
            <p className="profile-progress-note">Aucun essai récent pour le moment.</p>
          )
        ) : (
          <p className="profile-progress-note">Ce lien partage un récap live en lecture seule.</p>
        )}

        {!hasLoadedAccount ? (
          <p className="profile-progress-note">Chargement du lien public…</p>
        ) : !isAccountEmailVerified ? (
          <p className="profile-progress-note">Vérifie ton email pour générer un lien public.</p>
        ) : publicShareLink ? (
          <section className="profile-public-share-card" aria-live="polite">
            <p className="profile-public-share-url" title={publicShareLink.url}>
              {truncateShareUrl(publicShareLink.url)}
            </p>
            <p>
              Lien actif.
              {formatShareExpiryDate(publicShareLink.expiresAt)
                ? ` Expire le ${formatShareExpiryDate(publicShareLink.expiresAt)}.`
                : ""}
            </p>
            <div className="profile-public-share-actions">
              <button
                type="button"
                className="profile-share-btn"
                onClick={onCopyPublicShareLink}
                disabled={publicShareActionMode !== null}
              >
                Copier le lien
              </button>
              <button
                type="button"
                className="profile-share-btn"
                onClick={onRegeneratePublicShareLink}
                disabled={publicShareActionMode !== null}
              >
                {isRegeneratingLink ? "Régénération..." : "Régénérer"}
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            className="profile-share-btn"
            onClick={onGeneratePublicShareLink}
            disabled={publicShareActionMode !== null}
          >
            {isGeneratingLink ? "Génération..." : "Générer un lien"}
          </button>
        )}

        {shareFeedback ? (
          <p
            className={`share-feedback share-feedback-${shareFeedback.tone} profile-share-feedback`}
            role="status"
            aria-live="polite"
          >
            {shareFeedback.message}
          </p>
        ) : null}
      </section>
    );
  }

  function renderCurrentSessionLogoutSection() {
    if (isLogoutConfirmOpen) {
      return (
        <section className="profile-logout-confirm" aria-live="polite">
          <p className="account-muted">Tu vas être déconnecté(e). Tu pourras te reconnecter à tout moment.</p>
          <div className="profile-logout-confirm-actions">
            <button
              type="button"
              className="profile-logout-cancel-btn"
              onClick={() => setIsLogoutConfirmOpen(false)}
              disabled={isUiBusy}
            >
              Annuler
            </button>
            <form action={logoutAction}>
              <button type="submit" className="account-btn account-btn-danger">
                Se déconnecter maintenant
              </button>
            </form>
          </div>
        </section>
      );
    }

    return (
      <button
        type="button"
        className="account-btn account-btn-secondary"
        onClick={() => setIsLogoutConfirmOpen(true)}
        disabled={isUiBusy}
      >
        Se déconnecter
      </button>
    );
  }

  const modal = isOpen ? (
    <div className="profile-modal-overlay" onClick={onClose} role="presentation">
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Mon compte"
        onClick={(event) => event.stopPropagation()}
      >
        <section className="profile-content-grid">
          <section className="profile-tabpanel" aria-label="Informations du profil">
            <article className="account-card">
              <h2>Mon Compte</h2>

              <section className="profile-subcard" aria-label="Informations du profil parent">
                <h3>Profil</h3>
                <p className="account-kv">
                  <span>Email</span>
                  <strong>{accountOverview?.email || accountUserEmail || "—"}</strong>
                </p>
                <p className="account-kv">
                  <span>Créé</span>
                  <strong>{formatAccountDate(accountOverview?.createdAt ?? null) || "—"}</strong>
                </p>
                <p className="account-kv">
                  <span>Vérifié</span>
                  <strong>
                    {formatAccountDate(accountOverview?.emailVerifiedAt ?? null) || (accountOverview ? "Non" : "—")}
                  </strong>
                </p>

                {accountOverview && !accountOverview.emailVerifiedAt ? (
                  <form onSubmit={onSendVerificationEmail} className="account-inline-form">
                    <input type="hidden" name="__mode" value="modal" />
                    <button type="submit" className="account-btn" disabled={isAccountPending}>
                      Envoyer un lien de vérification
                    </button>
                  </form>
                ) : null}
              </section>

              <section className="profile-subcard" aria-label="Informations enfant">
                <h3>Enfant</h3>
                <div className="profile-form">
                  <label htmlFor="child-first-name">Prénom</label>
                  <input
                    id="child-first-name"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.currentTarget.value)}
                    placeholder="Ex: Louise"
                    autoComplete="off"
                  />

                  <label htmlFor="child-birth-date">Date de naissance</label>
                  <input
                    id="child-birth-date"
                    type="date"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.currentTarget.value)}
                  />
                </div>
              </section>

              {renderShareSection()}

              {profileErrorMessage ? <p className="profile-error">{profileErrorMessage}</p> : null}

              <div className="profile-actions">
                <button type="button" onClick={onClose} disabled={isUiBusy}>
                  Annuler
                </button>
                <button type="button" onClick={onSave} disabled={!isDirty || !isValid || isUiBusy}>
                  Enregistrer
                </button>
              </div>
            </article>
          </section>

          <section className="profile-tabpanel" aria-label="Sécurité du compte">
            <article className="account-card">
              <h2>Sécurité</h2>

              <p className="account-muted">
                Mot de passe oublié ? <Link href="/forgot-password">Réinitialiser</Link>.
              </p>

              {isAccountEmailVerified ? (
                <form onSubmit={onChangePassword} className="account-form">
                  <input type="hidden" name="__mode" value="modal" />

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

                  <button type="submit" className="account-btn" disabled={isAccountPending}>
                    Mettre à jour
                  </button>
                </form>
              ) : (
                <p className="account-muted">Vérifie ton email pour modifier le mot de passe et gérer les sessions.</p>
              )}

              <section className="profile-security-actions" aria-label="Actions de session">
                {isAccountEmailVerified ? (
                  <form onSubmit={onLogoutEverywhere} className="account-inline-form">
                    <input type="hidden" name="__mode" value="modal" />
                    <button type="submit" className="account-btn account-btn-secondary" disabled={isAccountPending}>
                      Déconnecter les autres appareils
                    </button>
                  </form>
                ) : null}

                {renderCurrentSessionLogoutSection()}
              </section>
            </article>

            {accountLoadError ? <p className="error-text account-global-error">{accountLoadError}</p> : null}
            {accountFeedback ? (
              <p
                className={`${accountFeedback.tone === "error" ? "error-text" : "info-text"} account-global-error`}
                role="status"
                aria-live="polite"
              >
                {accountFeedback.message}
              </p>
            ) : null}
          </section>
        </section>
      </section>
    </div>
  ) : null;

  return (
    <div className="profile-menu">
      <button type="button" className="profile-btn" onClick={() => setIsOpen(true)}>
        Mon compte
      </button>
      {isMounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
