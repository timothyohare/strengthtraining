"use client";

import { useEffect, useState } from "react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestRestAlert,
} from "../rest-alerts/actions";

type Status =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "blocked"
  | "off"
  | "on";

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// iOS only allows web push for an app opened from the Home Screen.
function isIosBrowserTab() {
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function currentStatus(): Promise<Status> {
  if (isIosBrowserTab()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

export function RestAlerts({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    currentStatus()
      .then(setStatus)
      .catch(() => setStatus("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      // Called straight from the tap: Safari only shows the permission
      // prompt in response to a user gesture.
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(vapidPublicKey),
      });
      await savePushSubscription(subscription.endpoint);
      setStatus("on");
    } catch {
      setStatus(await currentStatus().catch(() => "off" as const));
      setMessage(
        "Couldn’t turn on alerts. If you said no to the prompt, allow notifications for Lift5 (on iPhone: Settings → Notifications → Lift5).",
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setMessage("Couldn’t turn off alerts. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const scheduled = await sendTestRestAlert();
      setMessage(
        scheduled
          ? "Sent. Lock your phone or switch apps; it arrives in about 5 seconds."
          : "Alerts aren’t set up on the server yet.",
      );
    } catch {
      setMessage("Couldn’t send a test. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded-xl border border-line px-4 py-2.5 text-sm font-semibold disabled:text-muted";

  return (
    <div className="mt-3 flex flex-col gap-3">
      {status === "checking" && <p className="text-sm text-muted">Checking…</p>}
      {status === "needs-install" && (
        <p className="text-sm text-muted">
          iPhone only allows alerts for apps on the Home Screen. In Safari, tap
          Share → Add to Home Screen, then open Lift5 from there and come back
          here.
        </p>
      )}
      {status === "unsupported" && (
        <p className="text-sm text-muted">This browser can’t show alerts.</p>
      )}
      {status === "blocked" && (
        <p className="text-sm text-muted">
          Alerts are blocked. Allow notifications for Lift5 (on iPhone:
          Settings → Notifications → Lift5), then come back here.
        </p>
      )}
      {status === "off" && (
        <button type="button" disabled={busy} onClick={turnOn} className={button}>
          {busy ? "Turning on…" : "Turn on rest alerts"}
        </button>
      )}
      {status === "on" && (
        <>
          <p className="text-sm text-ink">On for this device.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={test} className={`${button} flex-1`}>
              Send a test
            </button>
            <button type="button" disabled={busy} onClick={turnOff} className={`${button} flex-1`}>
              Turn off
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
