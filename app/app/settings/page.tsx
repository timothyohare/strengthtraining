import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import {
  DEFAULT_SETTINGS,
  getAllLifts,
  getProfile,
  getSettings,
} from "@/lib/db/schema";
import { switchUnits, saveSettings } from "./actions";

export default async function SettingsPage() {
  // Defensive check, same as app/today/page.tsx.
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );

  if (!session) {
    redirect("/login");
  }

  const userId = session.userId;
  const [profile, settings, lifts] = await Promise.all([
    getProfile(userId),
    getSettings(userId),
    getAllLifts(userId),
  ]);

  const units = profile?.units ?? "kg";
  const resolvedSettings = settings ?? DEFAULT_SETTINGS;

  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <Link
          href="/today"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Back to today
        </Link>
      </div>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="font-semibold">Units</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Switching units converts every stored weight below to the
          equivalent value in the new unit, so nothing needs re-entering just
          because the label changed.
        </p>
        <form action={switchUnits} className="mt-3 flex items-center gap-2">
          <select
            name="units"
            defaultValue={units}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
          <button
            type="submit"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Switch units
          </button>
        </form>
      </section>

      <form action={saveSettings} className="flex flex-col gap-4">
        <section className="rounded border border-neutral-200 p-4">
          <h2 className="font-semibold">Bar &amp; plates</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Bar weight ({units})
              <input
                type="number"
                step="0.5"
                name="barWeight"
                defaultValue={resolvedSettings.barWeight}
                className="rounded border border-neutral-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Available plates ({units}, comma separated, one side)
              <input
                type="text"
                name="availablePlates"
                defaultValue={resolvedSettings.availablePlates.join(", ")}
                className="rounded border border-neutral-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Rest timer (seconds)
              <input
                type="number"
                step="1"
                name="restTimerSeconds"
                defaultValue={resolvedSettings.restTimerSeconds}
                className="rounded border border-neutral-300 px-2 py-1.5"
              />
            </label>
          </div>
        </section>

        {lifts.length > 0 && (
          <section className="rounded border border-neutral-200 p-4">
            <h2 className="font-semibold">Lifts</h2>
            <div className="mt-3 flex flex-col gap-4">
              {lifts.map((lift) => (
                <div key={lift.liftName} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">{lift.liftName}</h3>
                  <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                      Current weight ({units})
                      <input
                        type="number"
                        step="0.5"
                        name={`weight-${lift.liftName}`}
                        defaultValue={lift.currentWeight}
                        className="rounded border border-neutral-300 px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                      Increment ({units})
                      <input
                        type="number"
                        step="0.5"
                        name={`increment-${lift.liftName}`}
                        defaultValue={lift.increment}
                        className="rounded border border-neutral-300 px-2 py-1.5"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <button
          type="submit"
          className="rounded bg-black py-4 text-lg font-semibold text-white"
        >
          Save
        </button>
      </form>
    </main>
  );
}
