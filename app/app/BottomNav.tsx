"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/today",
    label: "Today",
    // Barbell
    icon: (
      <path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8" />
    ),
  },
  {
    href: "/history",
    label: "History",
    // Trend line
    icon: <path d="M3 17l5-5 4 4 8-8M15 8h5v5" />,
  },
  {
    href: "/settings",
    label: "Settings",
    // Sliders
    icon: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="15" cy="6" r="2" fill="currentColor" />
        <circle cx="8" cy="12" r="2" fill="currentColor" />
        <circle cx="17" cy="18" r="2" fill="currentColor" />
      </>
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider ${
                  active ? "text-volt" : "text-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Page frame for the signed-in screens: room at the bottom for the tab bar.
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pt-6 pb-28">
        {children}
      </main>
      <BottomNav />
    </>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <header>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide">
        {title}
      </h1>
    </header>
  );
}
