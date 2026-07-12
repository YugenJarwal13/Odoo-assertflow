import { useState, useEffect } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface LogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: { name: string; email: string; role: string };
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const { data } = await apiClient.get('/activity-logs');
        setLogs(data.data.logs);
      } catch (err) {
        console.error('Failed to load activity logs', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Activity Log
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit trail of all administrative actions in the system.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Entity ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-muted/50">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{log.user.name}</div>
                      <div className="text-xs text-muted-foreground">{log.user.role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-accent px-2 py-1 text-xs font-medium text-foreground">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.entityType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {log.entityId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
