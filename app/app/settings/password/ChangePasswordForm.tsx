"use client";

import { useActionState } from "react";
import { PASSWORD_RULES } from "@/lib/password";
import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { status: "idle" };

const input =
  "w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base text-ink outline-none focus:border-volt";
const label = "flex flex-col gap-1.5 text-sm font-medium text-muted";

export function ChangePasswordForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-ink"
      >
        Password changed. You&rsquo;re still signed in here; every other
        device has been signed out.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-miss/40 bg-miss/10 px-4 py-3 text-sm text-miss"
        >
          {state.message}
        </p>
      )}
      {/* Lets password managers file the new password under the right account. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        defaultValue={username}
        hidden
        readOnly
      />
      <label className={label}>
        Current password
        <input
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          className={input}
        />
      </label>
      <label className={label}>
        New password
        <input
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={12}
          aria-describedby="password-rules"
          className={input}
        />
      </label>
      <label className={label}>
        Confirm new password
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          className={input}
        />
      </label>
      <p id="password-rules" className="text-xs text-muted">
        {PASSWORD_RULES}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-2xl bg-volt py-4 font-display text-xl font-bold uppercase tracking-wider text-volt-ink disabled:opacity-60"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
