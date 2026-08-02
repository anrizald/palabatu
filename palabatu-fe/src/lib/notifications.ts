import { api } from './api.js';
import type { Notification } from '../types/notification.js';
import type { CountResponse } from '../types/apitypes.js';

// Header's bell and the /notifications page each hold their own copy of read
// state; Header never remounts on route change, so it needs to know when the
// page mutates the same underlying data. Dispatched after every write below.
export const NOTIFICATIONS_CHANGED_EVENT = 'palabatu:notifications-changed';

function notifyChanged(): void {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export async function listNotifications(): Promise<Notification[]> {
    return api.get<Notification[]>('/api/notifications');
}

export async function getUnreadCount(): Promise<number> {
    const { count } = await api.get<CountResponse>('/api/notifications/unread-count');
    return count;
}

export async function markRead(id: string): Promise<void> {
    await api.post<unknown>(`/api/notifications/${id}/read`, {});
    notifyChanged();
}

export async function markAllRead(): Promise<void> {
    await api.post<unknown>('/api/notifications/read-all', {});
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
