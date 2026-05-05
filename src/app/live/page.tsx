import Link from "next/link";

export default function LivePage() {
  return (
    <main className="flex min-h-0 flex-1 items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Under construction
        </h1>
        <p className="text-sm text-muted-foreground">
          Live environment is coming soon.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Back to landing page
        </Link>
      </div>
    </main>
  );
}
