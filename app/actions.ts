"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { upsertExposure, upsertFirstTastedOn, upsertNote, upsertPreference } from "@/lib/data";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

export async function setExposureAction(formData: FormData) {
  requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));
  const current = Number(formData.get("current"));

  if (!Number.isFinite(foodId) || ![1, 2, 3].includes(selected)) return;
  const nextValue = selected === current ? 0 : selected;

  await upsertExposure(foodId, nextValue);
  revalidatePath("/");
}

export async function setPreferenceAction(formData: FormData) {
  requireAuth();

  const foodId = Number(formData.get("foodId"));
  const selected = Number(formData.get("value"));
  const current = Number(formData.get("current"));

  if (!Number.isFinite(foodId) || ![-1, 1].includes(selected)) return;
  const nextValue = selected === current ? 0 : selected;

  await upsertPreference(foodId, nextValue as -1 | 0 | 1);
  revalidatePath("/");
}

export async function setFirstTastedOnAction(formData: FormData) {
  requireAuth();

  const foodId = Number(formData.get("foodId"));
  const firstTastedOnRaw = String(formData.get("firstTastedOn") || "").trim();
  const firstTastedOn = firstTastedOnRaw || null;

  if (!Number.isFinite(foodId)) return;
  if (firstTastedOn && !isValidIsoDate(firstTastedOn)) return;

  await upsertFirstTastedOn(foodId, firstTastedOn);
  revalidatePath("/");
}

export async function setNoteAction(formData: FormData) {
  requireAuth();

  const foodId = Number(formData.get("foodId"));
  const note = String(formData.get("note") || "").trim();

  if (!Number.isFinite(foodId)) return;

  await upsertNote(foodId, note);
  revalidatePath("/");
}
