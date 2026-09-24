"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--rose)_12%,white)] text-2xl">⚠</div>
      <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{error.message || "An unexpected error occurred while loading this page."}</p>
      <button onClick={reset} className="btn btn-dark mt-5">Try again</button>
    </div>
  );
}
