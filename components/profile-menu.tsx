"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createShareSnapshotAction,
  revokeShareSnapshotAction,
  saveChildProfileAction,
  trackShareEventAction
} from "@/app/actions";
import {
  changePasswordAction,
  getAccountOverviewAction,
  logoutEverywhereAction,
  sendVerificationEmailAction
} from "@/app/account/actions";
import { getClientTimezoneOffsetMinutes, getCurrentIsoDate } from "@/lib/date-utils";
import type { ChildProfile, ProgressSummary } from "@/lib/types";

type ProfileMenuProps = {
  initialProfile: ChildProfile | null;
  progressSummary?: ProgressSummary | null;
};

type ShareFeedbackTone = "success" | "error" | "info";

type GetAccountOverviewOkResult = Extract<
  Awaited<ReturnType<typeof getAccountOverviewAction>>,
  { ok: true }
>;

type AccountOverviewDTO = NonNullable<GetAccountOverviewOkResult["overview"]>;

type ActiveShareLink = {
  shareId: string;
  shareUrl: string;
  expiresAt: string | null;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILESTONE_THRESHOLDS = [10, 25, 50, 100];
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

function createShareId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto !== "undefined" && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (typeof webCrypto !== "undefined" && typeof webCrypto.getRandomValues === "function") {
    const randomBytes = new Uint8Array(16);
    webCrypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  throw new Error("Secure random generator unavailable.");
}

function buildSnapshotUrl(origin: string, shareId: string) {
  const query = new URLSearchParams();
  query.set("sid", shareId);

  return `${origin}/share?${query.toString()}`;
}

function buildShareRecap(params: {
  childFirstName: string | null;
  introducedCount: number;
  totalFoods: number;
  likedCount: number;
  recentFoodNames: string[];
  shareUrl: string;
}) {
  const {
    childFirstName,
    introducedCount,
    totalFoods,
    likedCount,
    recentFoodNames,
    shareUrl
  } = params;

  const normalizedFirstName = childFirstName?.trim();
  const leadLine = normalizedFirstName
    ? `${normalizedFirstName} progresse sur Grrrignote 🐯`
    : "Progression diversification sur Grrrignote 🐯";

  const progressLine = `${introducedCount}/${totalFoods} aliments déjà testés.`;
  const likesLine =
    likedCount > 0
      ? `${likedCount} aliments déjà bien acceptés.`
      : "On continue les découvertes pour trouver ses préférés.";
  const recentLine =
    recentFoodNames.length > 0 ? `Derniers essais: ${recentFoodNames.join(", ")}.` : "";

  return [leadLine, progressLine, likesLine, recentLine, `Voir le récap: ${shareUrl}`]
    .filter(Boolean)
    .join("\n");
}

function buildMilestoneRecap(params: {
  childFirstName: string | null;
  milestone: number;
  introducedCount: number;
  likedCount: number;
  shareUrl: string;
}) {
  const { childFirstName, milestone, introducedCount, likedCount, shareUrl } = params;
  const normalizedFirstName = childFirstName?.trim();
  const leadLine = normalizedFirstName
    ? `🎉 ${normalizedFirstName} a atteint le palier ${milestone} aliments sur Grrrignote`
    : `🎉 Palier ${milestone} aliments atteint sur Grrrignote`;

  return [
    leadLine,
    `${introducedCount} aliments testés dont ${likedCount} déjà appréciés.`,
    "À ton tour de débloquer ce palier !",
    `Voir le récap: ${shareUrl}`
  ].join("\n");
}

export function ProfileMenu({ initialProfile, progressSummary = null }: ProfileMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();
  const [profileErrorMessage, setProfileErrorMessage] = useState("");
  const [isSharePending, setIsSharePending] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    tone: ShareFeedbackTone;
    message: string;
  } | null>(null);
  const [activeShareLink, setActiveShareLink] = useState<ActiveShareLink | null>(null);
  const [isRevokingShare, setIsRevokingShare] = useState(false);
  const shareFeedbackTimeoutRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<"child" | "account">("child");

  const [accountUserEmail, setAccountUserEmail] = useState("");
  const [accountOverview, setAccountOverview] = useState<AccountOverviewDTO | null>(null);
  const [accountLoadError, setAccountLoadError] = useState("");
  const [accountFeedback, setAccountFeedback] = useState<{
    tone: ShareFeedbackTone;
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
      setActiveShareLink(null);
      setIsSharePending(false);
      setIsRevokingShare(false);
      setActiveMilestone(null);
      setActiveTab("child");
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
  const canShareProgress = isSummaryAvailable && shareSnapshot.totalFoods > 0;

  function showShareFeedback(tone: ShareFeedbackTone, message: string) {
    if (shareFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(shareFeedbackTimeoutRef.current);
    }

    setShareFeedback({ tone, message });
    shareFeedbackTimeoutRef.current = window.setTimeout(() => {
      setShareFeedback(null);
      shareFeedbackTimeoutRef.current = null;
    }, SHARE_FEEDBACK_TIMEOUT_MS);
  }

  function getShareFirstName() {
    const currentFirstName = firstName.trim();
    if (currentFirstName) return currentFirstName;
    return initialFirstName || null;
  }

  function trackShareEvent(
    eventName:
      | "share_clicked"
      | "share_success"
      | "snapshot_link_created"
      | "milestone_share_clicked"
      | "milestone_share_success",
    channel: string,
    shareId?: string,
    milestone?: number
  ) {
    if (!isSummaryAvailable) return;

    const formData = new FormData();
    formData.set("eventName", eventName);
    formData.set("channel", channel);
    formData.set("introducedCount", String(shareSnapshot.introducedCount));
    formData.set("totalFoods", String(shareSnapshot.totalFoods));
    formData.set("likedCount", String(shareSnapshot.likedCount));

    if (shareSnapshot.recentFoodNames.length > 0) {
      formData.set("recentFoods", shareSnapshot.recentFoodNames.join(","));
    }
    if (shareId) {
      formData.set("shareId", shareId);
    }
    if (milestone && milestone > 0) {
      formData.set("milestone", String(milestone));
    }

    void trackShareEventAction(formData);
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

  function getAccountErrorMessage(code?: string) {
    if (code === "missing_fields") return "Tous les champs sont obligatoires.";
    if (code === "weak_password") return "Le mot de passe doit contenir au moins 8 caractères.";
    if (code === "password_mismatch") return "Les deux mots de passe ne correspondent pas.";
    if (code === "bad_password") return "Mot de passe actuel incorrect.";
    if (code === "unknown") return "Une erreur est survenue. Réessaie plus tard.";
    return "Une erreur est survenue.";
  }

  function ensureAccountLoaded() {
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
      } catch {
        setAccountLoadError("Impossible de charger les infos du compte.");
        accountLoadedRef.current = false;
      } finally {
        accountLoadingRef.current = false;
      }
    });
  }

  function onSelectChildTab() {
    setAccountFeedback(null);
    setAccountLoadError("");
    setActiveTab("child");
  }

  function onSelectAccountTab() {
    setProfileErrorMessage("");
    setActiveTab("account");
    ensureAccountLoaded();
  }

  function showAccountFeedback(tone: ShareFeedbackTone, message: string) {
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

        showAccountFeedback(
          "success",
          "Email de vérification envoyé."
        );
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

  async function createShareSnapshot(shareId: string, milestone?: number) {
    const formData = new FormData();
    formData.set("shareId", shareId);
    formData.set("firstName", getShareFirstName() || "");
    formData.set("introducedCount", String(shareSnapshot.introducedCount));
    formData.set("totalFoods", String(shareSnapshot.totalFoods));
    formData.set("likedCount", String(shareSnapshot.likedCount));

    if (shareSnapshot.recentFoodNames.length > 0) {
      formData.set("recentFoods", shareSnapshot.recentFoodNames.join(","));
    }
    if (milestone && milestone > 0) {
      formData.set("milestone", String(milestone));
    }

    return createShareSnapshotAction(formData);
  }

  async function onShareProgress() {
    if (!canShareProgress || isSharePending) return;

    setIsSharePending(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let shareId = "";
    try {
      shareId = createShareId();
    } catch {
      setIsSharePending(false);
      showShareFeedback("error", "Impossible de créer un lien de partage sécurisé.");
      return;
    }

    const snapshotResult = await createShareSnapshot(shareId);
    if (!snapshotResult.ok) {
      setIsSharePending(false);
      showShareFeedback("error", snapshotResult.error || "Impossible de créer le lien de partage.");
      return;
    }

    const snapshotUrl = buildSnapshotUrl(origin, shareId);
    setActiveShareLink({
      shareId,
      shareUrl: snapshotUrl,
      expiresAt: snapshotResult.expiresAt ?? null
    });

    trackShareEvent("snapshot_link_created", "snapshot", shareId);
    trackShareEvent("share_clicked", "button", shareId);

    const recapText = buildShareRecap({
      childFirstName: getShareFirstName(),
      introducedCount: shareSnapshot.introducedCount,
      totalFoods: shareSnapshot.totalFoods,
      likedCount: shareSnapshot.likedCount,
      recentFoodNames: shareSnapshot.recentFoodNames,
      shareUrl: snapshotUrl
    });

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "Récap diversification",
          text: recapText
        });
        trackShareEvent("share_success", "native", shareId);
        showShareFeedback("success", "Récap partagé.");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(recapText);
        trackShareEvent("share_success", "clipboard", shareId);
        showShareFeedback("success", "Récap copié.");
        return;
      }

      if (copyWithExecCommand(recapText)) {
        trackShareEvent("share_success", "fallback", shareId);
        showShareFeedback("success", "Récap copié.");
        return;
      }

      showShareFeedback("error", "Impossible de copier le récap pour le moment.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        showShareFeedback("info", "Partage annulé.");
      } else {
        showShareFeedback("error", "Le partage a échoué. Réessaie dans quelques secondes.");
      }
    } finally {
      setIsSharePending(false);
    }
  }

  async function onShareMilestone(milestone: number) {
    if (!canShareProgress || shareSnapshot.introducedCount < milestone || activeMilestone !== null) {
      return;
    }

    setActiveMilestone(milestone);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let shareId = "";
    try {
      shareId = createShareId();
    } catch {
      setActiveMilestone(null);
      showShareFeedback("error", "Impossible de créer un lien de partage sécurisé.");
      return;
    }

    const snapshotResult = await createShareSnapshot(shareId, milestone);
    if (!snapshotResult.ok) {
      setActiveMilestone(null);
      showShareFeedback("error", snapshotResult.error || "Impossible de créer le lien de partage.");
      return;
    }

    const snapshotUrl = buildSnapshotUrl(origin, shareId);
    setActiveShareLink({
      shareId,
      shareUrl: snapshotUrl,
      expiresAt: snapshotResult.expiresAt ?? null
    });

    trackShareEvent("snapshot_link_created", "snapshot", shareId, milestone);
    trackShareEvent("milestone_share_clicked", "milestone", shareId, milestone);

    const milestoneText = buildMilestoneRecap({
      childFirstName: getShareFirstName(),
      milestone,
      introducedCount: shareSnapshot.introducedCount,
      likedCount: shareSnapshot.likedCount,
      shareUrl: snapshotUrl
    });

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `Palier ${milestone} aliments`,
          text: milestoneText
        });
        trackShareEvent("milestone_share_success", "native", shareId, milestone);
        showShareFeedback("success", `Palier ${milestone} partagé.`);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(milestoneText);
        trackShareEvent("milestone_share_success", "clipboard", shareId, milestone);
        showShareFeedback("success", `Palier ${milestone} copié.`);
        return;
      }

      if (copyWithExecCommand(milestoneText)) {
        trackShareEvent("milestone_share_success", "fallback", shareId, milestone);
        showShareFeedback("success", `Palier ${milestone} copié.`);
        return;
      }

      showShareFeedback("error", "Impossible de copier ce palier pour le moment.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        showShareFeedback("info", "Partage annulé.");
      } else {
        showShareFeedback("error", "Le partage du palier a échoué. Réessaie dans quelques secondes.");
      }
    } finally {
      setActiveMilestone(null);
    }
  }

  async function onRevokeActiveShareLink() {
    if (!activeShareLink || isRevokingShare) return;

    setIsRevokingShare(true);

    try {
      const formData = new FormData();
      formData.set("shareId", activeShareLink.shareId);

      const result = await revokeShareSnapshotAction(formData);
      if (!result.ok) {
        showShareFeedback("error", result.error || "Impossible de révoquer ce lien.");
        return;
      }

      setActiveShareLink(null);
      showShareFeedback("success", "Lien de partage révoqué.");
    } catch {
      showShareFeedback("error", "Impossible de révoquer ce lien.");
    } finally {
      setIsRevokingShare(false);
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

  const modal = isOpen ? (
    <div className="profile-modal-overlay" onClick={onClose} role="presentation">
      <section
        className={`profile-modal ${activeTab === "account" ? "is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-modal-title">Profil</h2>

        <div className="profile-tabs" role="tablist" aria-label="Paramètres profil et compte">
          <button
            type="button"
            role="tab"
            id="profile-tab-child"
            aria-selected={activeTab === "child"}
            aria-controls="profile-tabpanel-child"
            className={`profile-tab ${activeTab === "child" ? "is-active" : ""}`}
            onClick={onSelectChildTab}
          >
            Profil enfant
          </button>
          <button
            type="button"
            role="tab"
            id="profile-tab-account"
            aria-selected={activeTab === "account"}
            aria-controls="profile-tabpanel-account"
            className={`profile-tab ${activeTab === "account" ? "is-active" : ""}`}
            onClick={onSelectAccountTab}
          >
            Compte
          </button>
        </div>

        {activeTab === "child" ? (
          <section
            id="profile-tabpanel-child"
            role="tabpanel"
            aria-labelledby="profile-tab-child"
            className="profile-tabpanel"
          >
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

              <section className="profile-progress-section" aria-label="Récapitulatif des progrès">
                <h3>Récap des progrès</h3>
                <p className="profile-progress-stats">
                  {shareSnapshot.introducedCount}/{shareSnapshot.totalFoods} aliments testés •{" "}
                  {shareSnapshot.likedCount} appréciés
                </p>

                {isSummaryAvailable ? (
                  shareSnapshot.recentFoodNames.length > 0 ? (
                    <p className="profile-progress-recent">
                      Derniers essais: {shareSnapshot.recentFoodNames.join(", ")}
                    </p>
                  ) : (
                    <p className="profile-progress-note">Aucun essai récent pour le moment.</p>
                  )
                ) : (
                  <p className="profile-progress-note">
                    Ouvre l&apos;onglet Suivi pour charger ce récap.
                  </p>
                )}

                <button
                  type="button"
                  className="profile-share-btn"
                  onClick={onShareProgress}
                  disabled={!canShareProgress || isSharePending}
                >
                  {isSharePending ? "Partage..." : "Partager les progrès"}
                </button>

                {activeShareLink ? (
                  <section className="profile-progress-note" aria-live="polite">
                    <p>
                      Lien actif créé.
                      {formatShareExpiryDate(activeShareLink.expiresAt)
                        ? ` Expire le ${formatShareExpiryDate(activeShareLink.expiresAt)}.`
                        : ""}
                    </p>
                    <p>
                      <a href={activeShareLink.shareUrl} target="_blank" rel="noreferrer">
                        Ouvrir le lien de partage
                      </a>
                    </p>
                    <button
                      type="button"
                      className="profile-share-btn"
                      onClick={onRevokeActiveShareLink}
                      disabled={isRevokingShare || isSharePending}
                    >
                      {isRevokingShare ? "Révocation..." : "Révoquer ce lien"}
                    </button>
                  </section>
                ) : null}

                <div className="profile-milestone-badges" aria-label="Paliers de progression">
                  {MILESTONE_THRESHOLDS.map((milestone) => {
                    const isUnlocked = shareSnapshot.introducedCount >= milestone;
                    const isCurrentPending = activeMilestone === milestone;

                    return (
                      <button
                        key={milestone}
                        type="button"
                        className={`profile-milestone-badge ${
                          isUnlocked ? "is-unlocked" : "is-locked"
                        }`}
                        onClick={() => onShareMilestone(milestone)}
                        disabled={!isUnlocked || activeMilestone !== null}
                        aria-label={
                          isUnlocked
                            ? `Partager le palier ${milestone} aliments`
                            : `Palier ${milestone} aliments verrouillé`
                        }
                        title={
                          isUnlocked
                            ? `Partager le palier ${milestone}`
                            : `Palier ${milestone} verrouillé`
                        }
                      >
                        {isCurrentPending ? "..." : milestone}
                      </button>
                    );
                  })}
                </div>

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
            </div>

            {profileErrorMessage ? <p className="profile-error">{profileErrorMessage}</p> : null}

            <div className="profile-actions">
              <button type="button" onClick={onClose} disabled={isProfilePending}>
                Annuler
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!isDirty || !isValid || isProfilePending}
              >
                Enregistrer
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "account" ? (
          <section
            id="profile-tabpanel-account"
            role="tabpanel"
            aria-labelledby="profile-tab-account"
            className="profile-tabpanel"
          >
            <section className="account-grid" aria-label="Paramètres du compte">
              <article className="account-card">
                <h2>Adresse email</h2>
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
                    {formatAccountDate(accountOverview?.emailVerifiedAt ?? null) ||
                      (accountOverview ? "Non" : "—")}
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
              </article>

              {isAccountEmailVerified ? (
                <>
                  <article className="account-card">
                    <h2>Sécurité</h2>
                    <p className="account-muted">Change ton mot de passe (8 caractères minimum).</p>

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
                  </article>

                  <article className="account-card">
                    <h2>Sessions</h2>
                    <p className="account-muted">
                      Si tu as oublié de te déconnecter ailleurs, tu peux invalider toutes les sessions.
                    </p>

                    <form onSubmit={onLogoutEverywhere} className="account-inline-form">
                      <input type="hidden" name="__mode" value="modal" />
                      <button
                        type="submit"
                        className="account-btn account-btn-secondary"
                        disabled={isAccountPending}
                      >
                        Déconnecter les autres appareils
                      </button>
                    </form>
                  </article>

                  <article className="account-card">
                    <h2>Aide</h2>
                    <p className="account-muted">
                      Mot de passe oublié ? <Link href="/forgot-password">Réinitialiser</Link>.
                    </p>
                  </article>
                </>
              ) : null}
            </section>

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

            <div className="profile-actions">
              <button type="button" onClick={onClose} disabled={isAccountPending}>
                Fermer
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  ) : null;

  return (
    <div className="profile-menu">
      <button type="button" className="profile-btn" onClick={() => setIsOpen(true)}>
        Profil
      </button>
      {isMounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
