import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, MessageCircle, Flag, Trash2, CheckCheck, Heart, Pencil, AtSign } from 'lucide-react';
import { useAuth } from '../lib/useAuth.js';
import { listNotifications, getUnreadCount, markRead, markAllRead, formatRelativeTime, NOTIFICATIONS_CHANGED_EVENT } from '../lib/notifications.js';
import type { Notification, NotificationType } from '../types/notification.js';

const TYPE_ICON: Record<NotificationType, typeof MessageCircle> = {
    comment: MessageCircle,
    send: CheckCheck,
    report_resolved: Flag,
    content_removed: Trash2,
    reaction: Heart,
    problem_edited: Pencil,
    problem_deleted: Trash2,
    mention: AtSign,
};

type NotificationBellProps = {
    onNavigate?: () => void;
};

export default function NotificationBell({ onNavigate }: NotificationBellProps) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const refresh = () => {
        if (!user) return;
        listNotifications().then(setItems);
        getUnreadCount().then(setUnreadCount);
    };

    useEffect(() => {
        refresh();
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    }, [user]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    const toggleOpen = () => {
        if (!isOpen) refresh();
        setIsOpen(prev => !prev);
    };

    const handleItemClick = async (n: Notification) => {
        if (!n.read) {
            await markRead(n.id);
            refresh();
        }
        setIsOpen(false);
        onNavigate?.();
    };

    const handleMarkAllRead = async () => {
        await markAllRead();
        refresh();
    };

    const recent = items.slice(0, 6);

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={toggleOpen}
                aria-label="Notifications"
                className="relative flex items-center justify-center p-1.5 rounded-lg bg-transparent border-0 text-text-dim hover:text-text hover:bg-white/5 transition-colors cursor-pointer"
            >
                <Bell size={18} className="shrink-0" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-accent text-[10px] font-bold text-ink leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] w-[320px] max-w-[calc(100vw-32px)] bg-panel border border-border rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.5)] overflow-hidden z-[60]">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <span className="font-serif text-sm font-black text-text">Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-[11px] text-accent bg-transparent border-0 p-0 hover:underline cursor-pointer"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                        {recent.length === 0 ? (
                            <div className="px-4 py-8 text-center text-xs text-text-dim italic">
                                No notifications yet.
                            </div>
                        ) : (
                            recent.map(n => {
                                const Icon = TYPE_ICON[n.type];
                                const body = (
                                    <div className={`flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${!n.read ? 'bg-accent/5' : ''}`}>
                                        <Icon size={16} className="shrink-0 mt-0.5 text-accent" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-text-secondary leading-snug">{n.message}</div>
                                            <div className="text-[10px] text-text-dim mt-1">{formatRelativeTime(n.created_at)}</div>
                                        </div>
                                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />}
                                    </div>
                                );
                                return n.problem_id ? (
                                    <Link key={n.id} to={`/problems/${n.problem_id}`} onClick={() => handleItemClick(n)} className="block no-underline">
                                        {body}
                                    </Link>
                                ) : (
                                    <button key={n.id} onClick={() => handleItemClick(n)} className="block w-full text-left bg-transparent border-0 p-0 cursor-pointer">
                                        {body}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <Link
                        to="/notifications"
                        onClick={() => { setIsOpen(false); onNavigate?.(); }}
                        className="block text-center py-2.5 text-xs text-accent border-t border-border hover:bg-white/5 transition-colors no-underline"
                    >
                        View all
                    </Link>
                </div>
            )}
        </div>
    );
}
