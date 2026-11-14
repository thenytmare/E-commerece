'use client';

import React, { useMemo, useState } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { ActivityTimeline, type ActivityItem } from '@/components/admin/ui/ActivityTimeline';
import { List, GitCommitVertical, Plus, Pencil, Trash2, Activity } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: { name: string; email: string } | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

/** Maps an audit action onto a timeline icon + colour. */
function iconFor(action: string) {
  if (action.includes('create')) {
    return { icon: Plus, iconBgColor: 'bg-green-100', iconColor: 'text-green-700' };
  }
  if (action.includes('update')) {
    return { icon: Pencil, iconBgColor: 'bg-blue-100', iconColor: 'text-blue-700' };
  }
  if (action.includes('delete')) {
    return { icon: Trash2, iconBgColor: 'bg-red-100', iconColor: 'text-red-700' };
  }
  return { icon: Activity, iconBgColor: 'bg-muted', iconColor: 'text-muted-foreground' };
}

export function ActivityLogClient({ logs }: { logs: AuditEntry[] }) {
  const [view, setView] = useState<'table' | 'timeline'>('table');

  const timelineItems: ActivityItem[] = useMemo(
    () =>
      logs.map((log) => {
        const actorLabel = log.actor ? (log.actor.name || log.actor.email) : 'System';
        return {
          id: log.id,
          title: `${actorLabel} · ${log.action}`,
          description: `${log.entity}${log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ''}${
            log.ipAddress ? ` — from ${log.ipAddress}` : ''
          }`,
          timestamp: new Date(log.createdAt),
          ...iconFor(log.action),
        };
      }),
    [logs]
  );

  const columns: ColumnDef<AuditEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      cell: (item) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
          item.action.includes('create') ? 'bg-green-100 text-green-800' :
          item.action.includes('update') ? 'bg-blue-100 text-blue-800' :
          item.action.includes('delete') ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {item.action}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      cell: (item) => (
        <span>
          {item.entity}
          {item.entityId && (
            <span className="text-xs text-muted-foreground ml-1">({item.entityId.slice(0, 8)}...)</span>
          )}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      cell: (item) => (
        item.actor ? (
          <div>
            <p className="text-sm font-medium">{item.actor.name}</p>
            <p className="text-xs text-muted-foreground">{item.actor.email}</p>
          </div>
        ) : <span className="text-muted-foreground text-xs">System</span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      cell: (item) => (
        <span className="text-xs text-muted-foreground">{item.ipAddress ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      cell: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(item.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              view === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            <List className="h-4 w-4" />
            Table
          </button>
          <button
            type="button"
            onClick={() => setView('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
              view === 'timeline' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            <GitCommitVertical className="h-4 w-4" />
            Timeline
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <DataTable
          data={logs}
          columns={columns}
          emptyTitle="No activity yet"
          emptyMessage="Admin actions like creating or editing products will show up here."
          emptyIcon={Activity}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <ActivityTimeline items={timelineItems} />
        </div>
      )}
    </>
  );
}
