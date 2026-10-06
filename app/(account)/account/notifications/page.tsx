"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import type { Notification } from "@prisma/client";
import { Check, CheckCheck, Bell, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  const loadNotifications = async (p: number) => {
    setLoading(true);
    const res = await getNotifications(p, limit);
    if (res.success) {
      setNotifications(res.notifications);
      setTotal(res.total);
      setUnreadCount(res.unreadCount);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications(page);
  }, [page]);

  const handleMarkAllRead = async () => {
    const res = await markAllNotificationsRead();
    if (res.success) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleMarkRead = async (id: string) => {
    const res = await markNotificationRead(id);
    if (res.success) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated with your order statuses, quotations and updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors text-primary"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          You have no notifications yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted/40 ${
                  !n.isRead ? "bg-muted/20 font-medium" : ""
                }`}
              >
                <div className="mt-1">
                  {!n.isRead ? (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  ) : (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className={`text-sm text-foreground ${!n.isRead ? "font-bold" : ""}`}>
                      {n.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(n.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    {n.link && (
                      <Link
                        href={n.link}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                      >
                        View Details <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline font-medium"
                      >
                        <Check className="h-3.5 w-3.5" /> Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-50 hover:bg-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
