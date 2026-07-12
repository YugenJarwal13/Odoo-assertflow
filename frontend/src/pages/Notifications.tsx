import { useState, useEffect } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    try {
      const { data } = await apiClient.get('/notifications');
      setNotifications(data.data.notifications);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay updated on your asset allocations and system activity.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-foreground">No notifications</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You're all caught up.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                className={`flex items-start gap-4 p-4 sm:px-6 sm:py-5 ${
                  notif.isRead ? 'bg-background' : 'bg-primary/5'
                }`}
              >
                <div className="mt-1">
                  {!notif.isRead && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${notif.isRead ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                    {notif.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notif.isRead && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
