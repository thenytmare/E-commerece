import { AlertTriangle } from 'lucide-react';

/**
 * Renders the `?error=` values that requirePermission() redirects with.
 *
 * A rejected server action redirects here rather than returning an error, so
 * without this the admin was silently bounced to the dashboard — any
 * in-progress edit lost, and no indication anything had gone wrong.
 */
const MESSAGES: Record<string, string> = {
  forbidden: "Your account doesn't have permission to do that. Ask an administrator if you need access.",
  unauthorized: 'You need an administrator account to open that page.',
};

export function AdminErrorNotice({ error }: { error?: string }) {
  const message = error ? MESSAGES[error] : undefined;
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
