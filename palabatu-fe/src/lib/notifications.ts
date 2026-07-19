import type { Notification } from '../types/notification.js';

// No backend endpoint exists yet for notifications (see punchlist hard-tier #10).
// This module fakes one against localStorage so the UI can be built and used now;
// swapping to real data later means rewriting the bodies of the functions below
// (e.g. `api.get('/api/notifications')`) without touching any component that calls them.

function storageKey(userId: string): string {
    return `palabatu_notifications_mock_${userId}`;
}

function minutesAgo(n: number): string {
    return new Date(Date.now() - n * 60 * 1000).toISOString();
}

function seedNotifications(): Notification[] {
    return [
        {
            id: crypto.randomUUID(),
            type: 'comment',
            problem_id: null,
            problem_name: 'Crimson Roof',
            actor_name: 'sitiwir',
            message: "sitiwir commented on your problem \"Crimson Roof\"",
            read: false,
            created_at: minutesAgo(25),
        },
        {
            id: crypto.randomUUID(),
            type: 'send',
            problem_id: null,
            problem_name: 'Slab of Faith',
            actor_name: 'bagas.k',
            message: "bagas.k sent your problem \"Slab of Faith\"",
            read: false,
            created_at: minutesAgo(140),
        },
        {
            id: crypto.randomUUID(),
            type: 'report_resolved',
            problem_id: null,
            problem_name: 'Tiger Cave Traverse',
            actor_name: null,
            message: "Your report on \"Tiger Cave Traverse\" was resolved — the content was removed.",
            read: true,
            created_at: minutesAgo(60 * 26),
        },
        {
            id: crypto.randomUUID(),
            type: 'content_removed',
            problem_id: null,
            problem_name: 'Monkey Bar',
            actor_name: null,
            message: "A moderator removed a photo you added to \"Monkey Bar\" after a report.",
            read: true,
            created_at: minutesAgo(60 * 72),
        },
    ];
}

function load(userId: string): Notification[] {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (raw) return JSON.parse(raw);
    } catch {
        // fall through to reseed
    }
    const seeded = seedNotifications();
    save(userId, seeded);
    return seeded;
}

function save(userId: string, items: Notification[]): void {
    localStorage.setItem(storageKey(userId), JSON.stringify(items));
}

// Header's bell and the /notifications page each hold their own copy of read state;
// Header never remounts on route change, so it needs to know when the page mutates
// the same underlying data. Dispatched after every write below.
export const NOTIFICATIONS_CHANGED_EVENT = 'palabatu:notifications-changed';

function notifyChanged(): void {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export async function listNotifications(userId: string): Promise<Notification[]> {
    return [...load(userId)].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getUnreadCount(userId: string): Promise<number> {
    return load(userId).filter(n => !n.read).length;
}

export async function markRead(userId: string, id: string): Promise<void> {
    const items = load(userId);
    const target = items.find(n => n.id === id);
    if (target) {
        target.read = true;
        save(userId, items);
        notifyChanged();
    }
}

export async function markAllRead(userId: string): Promise<void> {
    const items = load(userId).map(n => ({ ...n, read: true }));
    save(userId, items);
    notifyChanged();
}

export function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / (60 * 1000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}
