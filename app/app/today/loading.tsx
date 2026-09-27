function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 ${className}`}
    />
  );
}

export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Bar className="h-6 w-36" />
          <Bar className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Bar className="h-8 w-20" />
          <Bar className="h-8 w-20" />
          <Bar className="h-8 w-20" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <section
            key={i}
            className="rounded border border-neutral-200 p-4"
          >
            <Bar className="h-5 w-32" />
            <Bar className="mt-2 h-8 w-48" />
            <Bar className="mt-2 h-4 w-40" />
          </section>
        ))}
      </div>
    </main>
  );
}
