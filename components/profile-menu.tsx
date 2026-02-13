"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveChildProfileAction, trackShareEventAction } from "@/app/actions";
import type { ChildProfile, ProgressSummary } from "@/lib/types";

type ProfileMenuProps = {
  initialProfile: ChildProfile | null;
  progressSummary?: ProgressSummary | null;
};

type ShareFeedbackTone = "success" | "error" | "info";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILESTONE_THRESHOLDS = [10, 25, 50, 100];
const SHARE_FEEDBACK_TIMEOUT_MS = 3200;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `sid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSnapshotUrl(params: {
  origin: string;
  childFirstName: string | null;
  introducedCount: number;
  totalFoods: number;
  likedCount: number;
  recentFoodNames: string[];
  shareId: string;
  milestone?: number;
}) {
  const {
    origin,
    childFirstName,
    introducedCount,
    totalFoods,
    likedCount,
    recentFoodNames,
    shareId,
    milestone
  } = params;

  const query = new URLSearchParams();
  query.set("sid", shareId);
  query.set("i", String(introducedCount));
  query.set("t", String(totalFoods));
  query.set("l", String(likedCount));

  const normalizedFirstName = childFirstName?.trim();
  if (normalizedFirstName) {
    query.set("n", normalizedFirstName.slice(0, 40));
  }

  const normalizedRecentFoods = recentFoodNames
    .map((food) => food.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (normalizedRecentFoods.length > 0) {
    query.set("r", normalizedRecentFoods.join("|"));
  }

  if (milestone && milestone > 0) {
    query.set("m", String(milestone));
  }

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
    ? `${normalizedFirstName} progresse sur Babymiam 🐯`
    : "Progression diversification sur Babymiam 🐯";

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
    ? `🎉 ${normalizedFirstName} a atteint le palier ${milestone} aliments sur Babymiam`
    : `🎉 Palier ${milestone} aliments atteint sur Babymiam`;

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
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSharePending, setIsSharePending] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const [shareFeedback, setShareFeedback] = useState<{
    tone: ShareFeedbackTone;
    message: string;
  } | null>(null);
  const shareFeedbackTimeoutRef = useRef<number | null>(null);

  const initialFirstName = initialProfile?.firstName ?? "";
  const initialBirthDate = initialProfile?.birthDate ?? "";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);

  useEffect(() => {
    if (!isOpen) {
      setFirstName(initialFirstName);
      setBirthDate(initialBirthDate);
      setErrorMessage("");
      setShareFeedback(null);
      setIsSharePending(false);
      setActiveMilestone(null);
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
    return birthDate <= getTodayIsoDate();
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

  async function onShareProgress() {
    if (!canShareProgress || isSharePending) return;

    setIsSharePending(true);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareId = createShareId();
    const snapshotUrl = buildSnapshotUrl({
      origin,
      childFirstName: getShareFirstName(),
      introducedCount: shareSnapshot.introducedCount,
      totalFoods: shareSnapshot.totalFoods,
      likedCount: shareSnapshot.likedCount,
      recentFoodNames: shareSnapshot.recentFoodNames,
      shareId
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
    const shareId = createShareId();
    const snapshotUrl = buildSnapshotUrl({
      origin,
      childFirstName: getShareFirstName(),
      introducedCount: shareSnapshot.introducedCount,
      totalFoods: shareSnapshot.totalFoods,
      likedCount: shareSnapshot.likedCount,
      recentFoodNames: shareSnapshot.recentFoodNames,
      shareId,
      milestone
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

  function onClose() {
    setIsOpen(false);
  }

  function onSave() {
    if (!isDirty || !isValid) return;

    const formData = new FormData();
    formData.set("firstName", firstName.trim());
    formData.set("birthDate", birthDate);

    startTransition(async () => {
      const result = await saveChildProfileAction(formData);
      if (!result.ok) {
        setErrorMessage(result.error || "Impossible d'enregistrer le profil.");
        return;
      }

      setErrorMessage("");
      setIsOpen(false);
      router.refresh();
    });
  }

  const modal = isOpen ? (
    <div className="profile-modal-overlay" onClick={onClose} role="presentation">
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-modal-title">Profil enfant</h2>

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
              {shareSnapshot.introducedCount}/{shareSnapshot.totalFoods} aliments testés • {shareSnapshot.likedCount} appréciés
            </p>

            {isSummaryAvailable ? (
              shareSnapshot.recentFoodNames.length > 0 ? (
                <p className="profile-progress-recent">Derniers essais: {shareSnapshot.recentFoodNames.join(", ")}</p>
              ) : (
                <p className="profile-progress-note">Aucun essai récent pour le moment.</p>
              )
            ) : (
              <p className="profile-progress-note">Ouvre l&apos;onglet Suivi pour charger ce récap.</p>
            )}

            <button
              type="button"
              className="profile-share-btn"
              onClick={onShareProgress}
              disabled={!canShareProgress || isSharePending}
            >
              {isSharePending ? "Partage..." : "Partager les progrès"}
            </button>

            <div className="profile-milestone-badges" aria-label="Paliers de progression">
              {MILESTONE_THRESHOLDS.map((milestone) => {
                const isUnlocked = shareSnapshot.introducedCount >= milestone;
                const isCurrentPending = activeMilestone === milestone;

                return (
                  <button
                    key={milestone}
                    type="button"
                    className={`profile-milestone-badge ${isUnlocked ? "is-unlocked" : "is-locked"}`}
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

        {errorMessage ? <p className="profile-error">{errorMessage}</p> : null}

        <div className="profile-actions">
          <button type="button" onClick={onClose} disabled={isPending}>
            Annuler
          </button>
          <button type="button" onClick={onSave} disabled={!isDirty || !isValid || isPending}>
            Enregistrer
          </button>
        </div>
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
