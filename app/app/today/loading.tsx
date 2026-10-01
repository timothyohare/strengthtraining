import { Screen } from "../BottomNav";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

export default function Loading() {
  return (
    <Screen>
      <div className="flex flex-col gap-2">
        <Bar className="h-3 w-20" />
        <Bar className="h-9 w-44" />
      </div>
      <Bar className="h-4 w-64" />
      {[0, 1, 2].map((i) => (
        <section key={i} className="rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <Bar className="h-6 w-28" />
            <Bar className="h-9 w-20" />
          </div>
          <Bar className="mt-2 h-4 w-36" />
          <div className="mt-4 grid grid-cols-5 gap-2.5">
            {[0, 1, 2, 3, 4].map((j) => (
              <div
                key={j}
                className="aspect-square animate-pulse rounded-full bg-surface-2"
              />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
