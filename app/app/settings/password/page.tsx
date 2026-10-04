import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Screen, ScreenHeader } from "../../BottomNav";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  // Defensive check, same as app/today/page.tsx.
  const session = await requireSession();

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
