import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { Screen, ScreenHeader } from "../../BottomNav";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  // Defensive check, same as app/today/page.tsx.
  const cookieStore = await cookies();
  const session = verifySessionToken(
    cookieStore.get(SESSION_COOKIE.name)?.value,
  );

  if (!session) {
    redirect("/login");
  }

  return (
    <Screen>
      <Link href="/settings" className="text-sm font-semibold text-muted">
        &larr; Settings
      </Link>
      <ScreenHeader
        eyebrow={`Signed in as ${session.userId}`}
        title="Change password"
      />
      <section className="rounded-2xl bg-surface p-4">
        <ChangePasswordForm username={session.userId} />
      </section>
    </Screen>
  );
}
