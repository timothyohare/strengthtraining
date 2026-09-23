export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Lift5</h1>
      <form
        action="/api/login"
        method="POST"
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <input
          type="text"
          name="username"
          placeholder="Username"
          autoComplete="username"
          required
          className="rounded border border-neutral-300 px-4 py-3 text-base"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          className="rounded border border-neutral-300 px-4 py-3 text-base"
        />
        <button
          type="submit"
          className="rounded bg-black px-4 py-3 text-base text-white"
        >
          Log in
        </button>
      </form>
      <p className="max-w-xs text-center text-sm text-neutral-500">
        Signed in via Amazon Cognito — accounts are admin-provisioned, no
        self-service sign-up (docs/prd.md §6).
      </p>
    </main>
  );
}
