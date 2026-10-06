"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import type { Notification } from "@prisma/client";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const res = await getNotifications(1, 5);
    if (res.success) {
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div className="relative z-50 flex items-center" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors"
        aria-label="View notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-background animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-background shadow-xl backdrop-blur-md p-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {notifications.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex flex-col gap-1 rounded-lg p-2.5 mx-1 my-0.5 text-xs transition-colors hover:bg-muted ${
                    !n.isRead ? "bg-muted/40 font-medium" : "text-muted-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className={`text-foreground ${!n.isRead ? "font-semibold" : ""}`}>
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-[10px] text-primary hover:underline shrink-0 font-semibold"
                        title="Mark read"
                      >
                        Read
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground/80">
                    <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-0.5 text-primary hover:underline font-semibold"
                      >
                        Details <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border p-1 text-center">
            <Link
              href="/account/notifications"
              onClick={() => setIsOpen(false)}
              className="block rounded-lg py-1.5 text-center text-xs font-semibold text-primary hover:bg-muted transition-colors"
            >
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
