"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, getAuthenticatedUsername, requireAuth } from "@/lib/auth";
import {
  upsertChildProfile,
  upsertExposure,
  upsertFirstTastedOn,
  upsertNote,
  upsertPreference
} from "@/lib/data";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function setExposureAction(formData: FormData) {
  await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));

  if (!Number.isFinite(foodId) || ![1, 2, 3].includes(selected)) return;
  await upsertExposure(foodId, selected);
  revalidatePath("/");
}

export async function setPreferenceAction(formData: FormData) {
  await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));

  if (!Number.isFinite(foodId) || ![-1, 1].includes(selected)) return;
  await upsertPreference(foodId, selected as -1 | 1);
  revalidatePath("/");
}

export async function setFirstTastedOnAction(formData: FormData) {
  await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const firstTastedOnRaw = String(formData.get("firstTastedOn") || "").trim();
  const firstTastedOn = firstTastedOnRaw || null;

  if (!Number.isFinite(foodId)) return;
  if (firstTastedOn && !isValidIsoDate(firstTastedOn)) return;

  await upsertFirstTastedOn(foodId, firstTastedOn);
  revalidatePath("/");
}

export async function setNoteAction(formData: FormData) {
  await requireAuth();

  const foodId = Number(formData.get("foodId"));
  const note = String(formData.get("note") || "").trim();

  if (!Number.isFinite(foodId)) return;

  await upsertNote(foodId, note);
  revalidatePath("/");
}

export async function saveChildProfileAction(formData: FormData) {
  await requireAuth();
  const ownerKey = await getAuthenticatedUsername();

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

  await upsertChildProfile(ownerKey, firstName, birthDate);
  revalidatePath("/");
  return { ok: true };
}
