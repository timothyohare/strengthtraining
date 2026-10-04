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
import { Screen, ScreenHeader } from "../BottomNav";
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

  const input =
    "w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base text-ink tabular-nums outline-none focus:border-volt";
  const label = "flex flex-col gap-1.5 text-sm font-medium text-muted";
  const card = "rounded-2xl bg-surface p-4";
  const cardTitle =
    "font-display text-xl font-bold uppercase tracking-wide text-ink";

  return (
    <Screen>
      <ScreenHeader eyebrow={`Signed in as ${userId}`} title="Settings" />

      <section className={card}>
        <h2 className={cardTitle}>Units</h2>
        <p className="mt-1 text-sm text-muted">
          Switching converts every saved weight to the new unit, so you
          don&rsquo;t need to re-enter anything.
        </p>
        <form action={switchUnits} className="mt-3 flex items-center gap-2">
          <select name="units" defaultValue={units} className={`${input} flex-1`}>
            <option value="kg">Kilograms (kg)</option>
            <option value="lb">Pounds (lb)</option>
          </select>
          <button
            type="submit"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold"
          >
            Switch
          </button>
        </form>
      </section>

      <form action={saveSettings} className="flex flex-col gap-4">
        <section className={card}>
          <h2 className={cardTitle}>Bar &amp; plates</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className={label}>
              Bar weight ({units})
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                name="barWeight"
                defaultValue={resolvedSettings.barWeight}
                className={input}
              />
            </label>
            <label className={label}>
              Plates you own ({units}, one side, separated by commas)
              <input
                type="text"
                name="availablePlates"
                defaultValue={resolvedSettings.availablePlates.join(", ")}
                className={input}
              />
            </label>
            <label className={label}>
              Rest timer (seconds)
              <input
                type="number"
                inputMode="numeric"
                step="1"
                name="restTimerSeconds"
                defaultValue={resolvedSettings.restTimerSeconds}
                className={input}
              />
            </label>
          </div>
        </section>

        {lifts.length > 0 && (
          <section className={card}>
            <h2 className={cardTitle}>Lifts</h2>
            <div className="mt-3 flex flex-col divide-y divide-line">
              {lifts.map((lift) => (
                <div key={lift.liftName} className="flex flex-col gap-2 py-3">
                  <h3 className="font-semibold">{lift.liftName}</h3>
                  <div className="flex gap-3">
                    <label className={`${label} flex-1`}>
                      Working weight ({units})
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        name={`weight-${lift.liftName}`}
                        defaultValue={lift.currentWeight}
                        className={input}
                      />
                    </label>
                    <label className={`${label} flex-1`}>
                      Add each time ({units})
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        name={`increment-${lift.liftName}`}
                        defaultValue={lift.increment}
                        className={input}
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
          className="rounded-2xl bg-volt py-4 font-display text-xl font-bold uppercase tracking-wider text-volt-ink"
        >
          Save settings
        </button>
      </form>

      <section className={card}>
        <h2 className={cardTitle}>Password</h2>
        <p className="mt-1 text-sm text-muted">
          Change the password you use to log in.
        </p>
        <Link
          href="/settings/password"
          className="mt-3 block rounded-xl border border-line px-4 py-2.5 text-center text-sm font-semibold"
        >
          Change password
        </Link>
      </section>

      <form action="/api/logout" method="POST">
        <button
          type="submit"
          className="w-full rounded-2xl border border-line py-3.5 font-semibold text-muted"
        >
          Log out
        </button>
      </form>
    </Screen>
  );
}
