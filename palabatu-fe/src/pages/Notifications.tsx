import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, MessageCircle, Flag, Trash2, CheckCheck, Heart, Pencil, AtSign } from 'lucide-react';
import { useAuth } from '../lib/useAuth.js';
import { listNotifications, markRead, markAllRead, formatRelativeTime } from '../lib/notifications.js';
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

export default function Notifications() {
    const { user } = useAuth();
    const [items, setItems] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = () => {
        if (!user) return;
        setIsLoading(true);
        listNotifications().then(data => {
            setItems(data);
            setIsLoading(false);
        });
    };

    useEffect(() => {
        refresh();
    }, [user]);

    const unreadCount = items.filter(n => !n.read).length;

    const handleItemClick = async (n: Notification) => {
        if (!n.read && user) {
            await markRead(n.id);
            refresh();
        }
    };

    const handleMarkAllRead = async () => {
        if (!user) return;
        await markAllRead();
        refresh();
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center px-6 text-center">
                <div className="text-text-dim text-sm">Log in to view your notifications.</div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading notifications...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-12">
            <div className="max-w-[640px] mx-auto flex flex-col gap-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h1 className="font-serif text-2xl font-black text-text">Notifications</h1>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="text-xs text-accent bg-transparent border-0 p-0 hover:underline cursor-pointer"
                        >
                            Mark all read
                        </button>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <Bell size={28} className="text-text-dim shrink-0" />
                        <div className="text-sm text-text-dim italic">You're all caught up.</div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {items.map(n => {
                            const Icon = TYPE_ICON[n.type];
                            const content = (
                                <div className={`flex gap-3 items-start bg-panel border border-border rounded-2xl p-4 transition-colors hover:border-accent/40 ${!n.read ? 'bg-accent/5' : ''}`}>
                                    <div className="shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-accent/15 text-accent">
                                        <Icon size={16} className="shrink-0" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-text-secondary leading-snug">{n.message}</div>
                                        <div className="text-xs text-text-dim mt-1">{formatRelativeTime(n.created_at)}</div>
                                    </div>
                                    {!n.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />}
                                </div>
                            );
                            return n.problem_id ? (
                                <Link key={n.id} to={`/problems/${n.problem_id}`} onClick={() => handleItemClick(n)} className="block no-underline">
                                    {content}
                                </Link>
                            ) : (
                                <button key={n.id} onClick={() => handleItemClick(n)} className="block w-full text-left bg-transparent border-0 p-0 cursor-pointer">
                                    {content}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
