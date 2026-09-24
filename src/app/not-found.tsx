

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="grad-text text-6xl font-extrabold tracking-tight">404</div>
      <h1 className="mt-3 text-xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">The page or client you&apos;re looking for doesn&apos;t exist.</p>
      <a href="/" className="btn btn-dark mt-5">Back to dashboard</a>
    </div>
  );
}
