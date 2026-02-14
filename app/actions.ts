"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, requireAuth } from "@/lib/auth";
import {
  createGrowthEvent,
  markFirstTaste,
  upsertChildProfile,
  upsertExposure,
  upsertFirstTastedOn,
  upsertNote,
  upsertPreference,
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
  return new Date().toISOString().slice(0, 10);
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

export async function setExposureAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));

  if (!Number.isFinite(foodId) || ![1, 2, 3].includes(selected)) return;
  await upsertExposure(user.id, foodId, selected);
  revalidatePath("/");
}

export async function setPreferenceAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));

  if (!Number.isFinite(foodId) || ![-1, 0, 1].includes(selected)) return;
  await upsertPreference(user.id, foodId, selected as -1 | 0 | 1);
  revalidatePath("/");
}

export async function setFirstTastedOnAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const firstTastedOnRaw = String(formData.get("firstTastedOn") || "").trim();
  const firstTastedOn = firstTastedOnRaw || null;

  if (!Number.isFinite(foodId)) return;
  if (firstTastedOn && !isValidIsoDate(firstTastedOn)) return;

  await upsertFirstTastedOn(user.id, foodId, firstTastedOn);
  revalidatePath("/");
}

export async function markFirstTasteAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  if (!Number.isFinite(foodId)) return;

  await markFirstTaste(user.id, foodId, getTodayIsoDate());
  revalidatePath("/");
}

export async function setNoteAction(formData: FormData) {
  const user = await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const note = String(formData.get("note") || "").trim();

  if (!Number.isFinite(foodId)) return;

  await upsertNote(user.id, foodId, note);
  revalidatePath("/");
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
