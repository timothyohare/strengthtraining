"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import {
  DEFAULT_SETTINGS,
  getAllLifts,
  getProfile,
  getSettings,
  putLift,
  putProfile,
  putSettings,
  type SettingsItem,
} from "@/lib/db/schema";
import { convertWeight, type Units } from "@/lib/units";

async function requireUserId(): Promise<string> {
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );
  if (!session) redirect("/login");
  return session.userId;
}

function isUnits(value: FormDataEntryValue | null): value is Units {
  return value === "lb" || value === "kg";
}

/**
 * The only place unit conversion math runs (see lib/units.ts): switching
 * units re-expresses every already-stored weight field (lift weights,
 * increments, bar weight, plates) in the new unit, so nothing silently
 * becomes wrong just because its label changed. Editing individual values
 * is a separate action (`saveSettings`) that never converts -- it just
 * stores what's typed, in whatever unit is current.
 */
export async function switchUnits(formData: FormData) {
  const userId = await requireUserId();
  const newUnits = formData.get("units");
  if (!isUnits(newUnits)) return;

  const profile = await getProfile(userId);
  const prevUnits: Units = profile?.units ?? "kg";
  if (newUnits === prevUnits) return;

  await putProfile(userId, {
    displayName: profile?.displayName ?? userId,
    createdAt: profile?.createdAt ?? new Date().toISOString(),
    units: newUnits,
  });

  const settings = (await getSettings(userId)) ?? DEFAULT_SETTINGS;
  await putSettings(userId, {
    barWeight: convertWeight(settings.barWeight, prevUnits, newUnits),
    availablePlates: settings.availablePlates.map((p) =>
      convertWeight(p, prevUnits, newUnits),
    ),
    restTimerSeconds: settings.restTimerSeconds,
  });

  const lifts = await getAllLifts(userId);
  for (const lift of lifts) {
    await putLift(userId, {
      ...lift,
      currentWeight: convertWeight(lift.currentWeight, prevUnits, newUnits),
      increment: convertWeight(lift.increment, prevUnits, newUnits),
      roundTo: convertWeight(lift.roundTo, prevUnits, newUnits),
    });
  }

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
}

function parsePlates(input: string): number[] {
  return input
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function positiveNumberOr(value: FormDataEntryValue | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function saveSettings(formData: FormData) {
  const userId = await requireUserId();

  const current = (await getSettings(userId)) ?? DEFAULT_SETTINGS;
  const platesInput = parsePlates(String(formData.get("availablePlates") ?? ""));
  const next: SettingsItem = {
    barWeight: positiveNumberOr(formData.get("barWeight"), current.barWeight),
    availablePlates:
      platesInput.length > 0 ? platesInput : current.availablePlates,
    restTimerSeconds: positiveNumberOr(
      formData.get("restTimerSeconds"),
      current.restTimerSeconds,
    ),
  };
  await putSettings(userId, next);

  const lifts = await getAllLifts(userId);
  for (const lift of lifts) {
    await putLift(userId, {
      ...lift,
      currentWeight: positiveNumberOr(
        formData.get(`weight-${lift.liftName}`),
        lift.currentWeight,
      ),
      increment: positiveNumberOr(
        formData.get(`increment-${lift.liftName}`),
        lift.increment,
      ),
    });
  }

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
}
