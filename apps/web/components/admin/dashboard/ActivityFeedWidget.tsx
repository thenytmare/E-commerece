import { DashboardWidget } from '@/components/admin/ui/DashboardWidget';
import { getActivityFeedDashboard } from '@/lib/actions/admin-dashboard';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function ActivityFeedWidget() {
  let error: string | null = null;
  let events: {
    id: string;
    type: string;
    actor: string;
    createdAt: string;
    description: string;
  }[] = [];

  try {
    const data = await getActivityFeedDashboard();
    events = data.events;
  } catch (e) {
    console.error('ActivityFeedWidget: Failed to load activity', e);
    error = e instanceof Error ? e.message : 'Failed to load activity';
  }

  return (
    <DashboardWidget
      title="Recent Activity"
      icon="activity"
      requiredPermission="analytics.read"
      error={error}
      empty={!error && events.length === 0}
      emptyMessage="No recent activity"
      body={
        <ul className="space-y-3 max-h-72 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm border-b border-border pb-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{e.type}</p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2">{e.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{e.actor}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{timeAgo(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      }
    />
  );
}
