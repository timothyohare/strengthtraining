export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6">
      <div className="flex flex-col items-start gap-4">
        <svg
          viewBox="0 0 100 100"
          className="h-14 w-14"
          aria-hidden="true"
        >
          <rect width="100" height="100" rx="20" className="fill-surface" />
          <rect x="15" y="46" width="70" height="8" rx="2" className="fill-ink" />
          <rect x="10" y="34" width="10" height="32" rx="2" className="fill-volt" />
          <rect x="80" y="34" width="10" height="32" rx="2" className="fill-volt" />
          <rect x="22" y="26" width="8" height="48" rx="2" className="fill-volt" />
          <rect x="70" y="26" width="8" height="48" rx="2" className="fill-volt" />
        </svg>
        <div>
          <h1 className="font-display text-6xl font-extrabold uppercase leading-none tracking-wide">
            Lift5
          </h1>
          <p className="mt-2 text-muted">Five lifts. Five reps. Add weight.</p>
        </div>
      </div>

      <form action="/api/login" method="POST" className="flex flex-col gap-3">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-miss/40 bg-miss/10 px-4 py-3 text-sm text-miss"
          >
            That username and password didn&rsquo;t match. Try again.
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Username
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink outline-none focus:border-volt"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink outline-none focus:border-volt"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-xl bg-volt py-4 font-display text-xl font-bold uppercase tracking-wider text-volt-ink"
        >
          Log in
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        Accounts are set up by an admin.
      </p>
    </main>
  );
}
