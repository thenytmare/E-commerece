import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      <h2 className="text-4xl font-bold mb-2">404</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        The page you&apos;re looking for could not be found.
      </p>
      <Link
        href="/admin"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
