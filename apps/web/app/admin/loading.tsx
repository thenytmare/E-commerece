import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}
