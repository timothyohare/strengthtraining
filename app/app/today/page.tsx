import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export default async function TodayPage() {
  // Defensive check, not just relying on proxy.ts -- Next's own guidance is
  // that a matcher change could silently remove Proxy coverage, so every
  // protected page verifies its own session too.
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Today&apos;s workout</h1>
      <p className="text-neutral-500">
        Signed in as {session.userId}. This is a placeholder proving the
        session wall works end to end — the real program engine + DynamoDB
        wiring lands per docs/todo.md.
      </p>
      <form action="/api/logout" method="POST">
        <button
          type="submit"
          className="rounded border border-neutral-300 px-4 py-2 text-base"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
