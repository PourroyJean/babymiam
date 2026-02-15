"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, requireAuth } from "@/lib/auth";
import {
  appendQuickEntry,
  createGrowthEvent,
  deleteFoodTastingEntry,
  upsertChildProfile,
  upsertFinalPreference,
  upsertFoodTastingEntry,
  upsertNote,
  upsertShareSnapshot
} from "@/lib/data";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHARE_EVENT_NAMES = new Set([
  "share_clicked",
  "share_success",
  "snapshot_link_created",
  "milestone_share_clicked",
  "milestone_share_success"
]);
const SHARE_CHANNELS = new Set(["button", "native", "clipboard", "fallback", "snapshot", "milestone"]);
const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function getTodayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getNonNegativeInteger(formData: FormData, key: string) {
  const parsed = Number(formData.get(key));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function getRecentFoods(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((food) => food.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function saveTastingEntryAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const slot = Number(formData.get("slot"));
  const likedRaw = String(formData.get("liked") || "").trim().toLowerCase();
  const tastedOnRaw = String(formData.get("tastedOn") || "").trim();
  const tastedOn = tastedOnRaw || getTodayIsoDate();
  const note = String(formData.get("note") || "").trim();
  const hasNote = formData.has("note");

  if (!Number.isFinite(foodId) || ![1, 2, 3].includes(slot)) {
    return { ok: false, error: "Entrée invalide." };
  }

  if (likedRaw !== "yes" && likedRaw !== "no") {
    return { ok: false, error: "Choisis si bébé a aimé ou non." };
  }

  if (!isValidIsoDate(tastedOn)) {
    return { ok: false, error: "La date de dégustation est invalide." };
  }

  if (tastedOn > getTodayIsoDate()) {
    return { ok: false, error: "La date de dégustation ne peut pas être dans le futur." };
  }

  await upsertFoodTastingEntry(user.id, foodId, slot as 1 | 2 | 3, likedRaw === "yes", tastedOn);
  if (hasNote) {
    await upsertNote(user.id, foodId, note);
  }
  revalidatePath("/");
  return { ok: true };
}

export async function deleteTastingEntryAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const slot = Number(formData.get("slot"));

  if (!Number.isFinite(foodId) || ![1, 2, 3].includes(slot)) {
    return { ok: false, error: "Entrée invalide." };
  }

  const result = await deleteFoodTastingEntry(user.id, foodId, slot as 1 | 2 | 3);
  if (!result.ok) {
    return result;
  }

  revalidatePath("/");
  return { ok: true };
}

export async function setFinalPreferenceAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));

  if (!Number.isFinite(foodId) || ![-1, 0, 1].includes(selected)) {
    return { ok: false, error: "Choix final invalide." };
  }

  const appliedPreference = await upsertFinalPreference(user.id, foodId, selected as -1 | 0 | 1);
  revalidatePath("/");
  return { ok: true, appliedPreference };
}

export async function setNoteAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const note = String(formData.get("note") || "").trim();

  if (!Number.isFinite(foodId)) return;

  await upsertNote(user.id, foodId, note);
  revalidatePath("/");
}

export async function addQuickEntryAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const tastedOn = String(formData.get("tastedOn") || "").trim();
  const likedRaw = String(formData.get("liked") || "").trim().toLowerCase();
  const note = String(formData.get("note") || "").trim();

  if (!Number.isFinite(foodId)) {
    return { ok: false, error: "Aliment invalide." };
  }

  if (!isValidIsoDate(tastedOn)) {
    return { ok: false, error: "Date invalide." };
  }

  if (tastedOn > getTodayIsoDate()) {
    return { ok: false, error: "La date de dégustation ne peut pas être dans le futur." };
  }

  if (likedRaw !== "true" && likedRaw !== "false") {
    return { ok: false, error: "Préférence invalide." };
  }

  const result = await appendQuickEntry(user.id, {
    foodId,
    tastedOn,
    liked: likedRaw === "true",
    note
  });

  if (result.status === "food_not_found") {
    return { ok: false, error: "Aliment introuvable." };
  }

  if (result.status === "maxed") {
    return { ok: false, error: "Cet aliment est déjà à 3/3." };
  }

  if (result.status === "unavailable") {
    return { ok: false, error: "Ajout rapide indisponible pour le moment." };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function saveChildProfileAction(formData: FormData) {
  const user = await requireAuth();

  const firstName = String(formData.get("firstName") || "").trim();
  const birthDate = String(formData.get("birthDate") || "").trim();

  if (!firstName) {
    return { ok: false, error: "Le prénom est obligatoire." };
  }

  if (!isValidIsoDate(birthDate)) {
    return { ok: false, error: "La date de naissance est invalide." };
  }

  if (birthDate > getTodayIsoDate()) {
    return { ok: false, error: "La date de naissance ne peut pas être dans le futur." };
  }

  await upsertChildProfile(user.id, firstName, birthDate);
  revalidatePath("/");
  return { ok: true };
}

export async function createShareSnapshotAction(formData: FormData) {
  const user = await requireAuth();

  const shareId = String(formData.get("shareId") || "").trim();
  if (!SHARE_ID_PATTERN.test(shareId)) {
    return { ok: false, error: "Lien de partage invalide." };
  }

  const firstNameRaw = String(formData.get("firstName") || "").trim();
  const firstName = firstNameRaw ? firstNameRaw.slice(0, 40) : null;

  const introducedCount = getNonNegativeInteger(formData, "introducedCount") ?? 0;
  const totalFoodsRaw = getNonNegativeInteger(formData, "totalFoods") ?? 0;
  const likedCount = getNonNegativeInteger(formData, "likedCount") ?? 0;
  const milestoneRaw = getNonNegativeInteger(formData, "milestone");
  const recentFoods = getRecentFoods(formData, "recentFoods");

  const totalFoods = Math.max(totalFoodsRaw, introducedCount);
  const milestone = milestoneRaw !== null && milestoneRaw > 0 ? milestoneRaw : null;

  try {
    await upsertShareSnapshot(user.id, {
      shareId,
      firstName,
      introducedCount,
      totalFoods,
      likedCount,
      milestone,
      recentFoods,
      visibility: "public"
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Impossible de générer le lien de partage." };
  }
}

export async function trackShareEventAction(formData: FormData) {
  const user = await requireAuth();

  const eventName = String(formData.get("eventName") || "").trim();
  if (!SHARE_EVENT_NAMES.has(eventName)) return;

  const channelRaw = String(formData.get("channel") || "").trim();
  const channel = SHARE_CHANNELS.has(channelRaw) ? channelRaw : null;

  const metadata: Record<string, unknown> = {};
  const introducedCount = getNonNegativeInteger(formData, "introducedCount");
  const totalFoods = getNonNegativeInteger(formData, "totalFoods");
  const likedCount = getNonNegativeInteger(formData, "likedCount");
  const milestone = getNonNegativeInteger(formData, "milestone");
  const recentFoods = getRecentFoods(formData, "recentFoods");
  const shareIdRaw = String(formData.get("shareId") || "").trim();

  if (introducedCount !== null) metadata.introducedCount = introducedCount;
  if (totalFoods !== null) metadata.totalFoods = totalFoods;
  if (likedCount !== null) metadata.likedCount = likedCount;
  if (milestone !== null) metadata.milestone = milestone;
  if (recentFoods.length > 0) {
    metadata.recentFoods = recentFoods;
  }
  if (SHARE_ID_PATTERN.test(shareIdRaw)) {
    metadata.shareId = shareIdRaw;
  }

  try {
    await createGrowthEvent(user.id, eventName, channel, metadata, "private");
  } catch {
    // Tracking should never block core user actions.
  }
}
