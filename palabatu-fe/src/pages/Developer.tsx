import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/useAuth.js';
import Toast, { type ToastProps } from '../components/Toast.js';
import type { Analytics, DailyCount, TesterCandidate, ToggleTesterResponse } from '../types/devtools.js';
import type { FeedbackItem } from '../types/feedback.js';
import type { ErrorResponse } from '../types/apitypes.js';

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

const EXPORT_TABLES = ['users', 'problems', 'sends', 'comments', 'reports'] as const;

const API_DOCS: { method: string; route: string; auth: string; purpose: string }[] = [
    { method: 'POST', route: '/auth/signup', auth: 'Public', purpose: 'Create an account and send a verification email.' },
    { method: 'POST', route: '/auth/signin', auth: 'Public', purpose: 'Sign in, returns a JWT.' },
    { method: 'GET', route: '/auth/session', auth: 'Auth', purpose: 'Resolve the current JWT to a user.' },
    { method: 'GET', route: '/auth/verify-email', auth: 'Public', purpose: 'Consume an emailed verification token.' },
    { method: 'POST', route: '/auth/forgot-password', auth: 'Public', purpose: 'Email a password reset link.' },
    { method: 'POST', route: '/auth/reset-password', auth: 'Public', purpose: 'Consume a reset token, set a new password.' },
    { method: 'PUT', route: '/auth/password', auth: 'Auth', purpose: "Change the caller's own password." },
    { method: 'DELETE', route: '/auth/account', auth: 'Auth', purpose: "Delete the caller's own account." },
    { method: 'GET', route: '/auth/users/count', auth: 'Public', purpose: 'Total registered users (landing page stat).' },
    { method: 'GET', route: '/api/profiles/:id', auth: 'Public', purpose: 'Fetch a profile by id or slug.' },
    { method: 'PUT', route: '/api/profiles/:id', auth: 'Auth', purpose: "Upsert the caller's own profile." },
    { method: 'GET', route: '/api/profiles/:id/stats', auth: 'Public', purpose: 'Sends/problems-added counts.' },
    { method: 'GET', route: '/api/profiles/:id/activity', auth: 'Public', purpose: 'Recent sends and recently added problems.' },
    { method: 'GET', route: '/api/problems', auth: 'Public', purpose: 'List all problems.' },
    { method: 'GET', route: '/api/problems/:id', auth: 'Public', purpose: 'Fetch one problem.' },
    { method: 'POST', route: '/api/problems', auth: 'Auth', purpose: 'Create a problem.' },
    { method: 'PUT', route: '/api/problems/:id', auth: 'Auth (Founder/admin)', purpose: 'Edit a problem.' },
    { method: 'DELETE', route: '/api/problems/:id', auth: 'Auth (Founder/admin)', purpose: 'Delete a problem.' },
    { method: 'POST', route: '/api/problems/:id/images', auth: 'Auth (Founder/admin)', purpose: 'Attach already-uploaded images to a problem.' },
    { method: 'DELETE', route: '/api/problems/:id/images', auth: 'Auth (Founder/admin)', purpose: 'Remove one image from a problem.' },
    { method: 'GET', route: '/api/problems/:id/annotations', auth: 'Public', purpose: 'List topo-photo annotations.' },
    { method: 'PUT', route: '/api/problems/:id/annotations', auth: 'Auth (Founder/admin)', purpose: 'Save topo-photo annotations.' },
    { method: 'POST', route: '/api/upload/topo', auth: 'Auth', purpose: 'Upload a topo photo to Cloudinary.' },
    { method: 'POST', route: '/api/upload/avatar', auth: 'Auth', purpose: 'Upload a profile avatar to Cloudinary.' },
    { method: 'GET', route: '/api/problems/:id/send-status', auth: 'Auth', purpose: "Has the caller sent this problem?" },
    { method: 'POST', route: '/api/problems/:id/send', auth: 'Auth', purpose: 'Toggle a send (tick).' },
    { method: 'GET', route: '/api/problems/:id/comments', auth: 'Public', purpose: 'List comments on a problem.' },
    { method: 'POST', route: '/api/problems/:id/comments', auth: 'Auth', purpose: 'Post a comment (rate-limited).' },
    { method: 'DELETE', route: '/api/comments/:id', auth: 'Auth (owner/admin)', purpose: 'Delete a comment.' },
    { method: 'GET', route: '/api/profiles/:id/reactions', auth: 'Public', purpose: 'Reaction counts on a profile.' },
    { method: 'GET', route: '/api/profiles/:id/reactions/status', auth: 'Auth', purpose: "Caller's own reaction status." },
    { method: 'POST', route: '/api/profiles/:id/reactions/:type', auth: 'Auth', purpose: 'Toggle a reaction on a profile.' },
    { method: 'POST', route: '/api/comments/:id/report', auth: 'Auth', purpose: 'Report a comment (rate-limited).' },
    { method: 'POST', route: '/api/problems/:id/images/report', auth: 'Auth', purpose: 'Report a topo image (rate-limited).' },
    { method: 'GET', route: '/api/reports', auth: 'Auth (admin)', purpose: 'List pending moderation reports.' },
    { method: 'POST', route: '/api/reports/:id/resolve', auth: 'Auth (admin)', purpose: 'Dismiss a report or remove its content.' },
    { method: 'GET', route: '/api/notifications', auth: 'Auth', purpose: "List the caller's notifications." },
    { method: 'GET', route: '/api/notifications/unread-count', auth: 'Auth', purpose: 'Unread notification count.' },
    { method: 'POST', route: '/api/notifications/:id/read', auth: 'Auth', purpose: 'Mark one notification read.' },
    { method: 'POST', route: '/api/notifications/read-all', auth: 'Auth', purpose: 'Mark all notifications read.' },
    { method: 'POST', route: '/api/waitlist', auth: 'Public (rate-limited)', purpose: 'Join the pre-launch waitlist.' },
    { method: 'POST', route: '/api/feedback', auth: 'Public (rate-limited, optional auth)', purpose: 'Submit feedback / a bug report.' },
    { method: 'GET', route: '/api/feedback', auth: 'Owner', purpose: 'List open feedback submissions.' },
    { method: 'POST', route: '/api/feedback/:id/reviewed', auth: 'Owner', purpose: 'Mark a feedback submission reviewed.' },
    { method: 'GET', route: '/api/dev/export/:table', auth: 'Owner', purpose: 'Export users/problems/sends/comments/reports as JSON or CSV.' },
    { method: 'GET', route: '/api/dev/analytics', auth: 'Owner', purpose: 'Signup/problem/send trends and top lists.' },
    { method: 'GET', route: '/api/dev/testers/search', auth: 'Owner', purpose: 'Search users by email/username.' },
    { method: 'POST', route: '/api/dev/testers/:id/toggle', auth: 'Owner', purpose: 'Toggle a user’s is_tester flag.' },
    { method: 'GET', route: '/metrics', auth: 'Public', purpose: 'Prometheus HTTP metrics (unscraped today).' },
    { method: 'GET', route: '/healthz', auth: 'Public', purpose: 'Liveness check.' },
];

type Tab = 'analytics' | 'export' | 'testers' | 'feedback' | 'docs';

function BarRows({ data }: { data: DailyCount[] }) {
    if (data.length === 0) return <div className="text-xs text-text-dim italic">No activity in this window.</div>;
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="flex flex-col gap-1.5">
            {data.map(d => (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                    <span className="w-[84px] shrink-0 text-text-dim tabular-nums">{d.day}</span>
                    <div className="flex-1 h-[14px] bg-surface rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${Math.max((d.count / max) * 100, 4)}%` }}
                        />
                    </div>
                    <span className="w-6 shrink-0 text-right text-text-secondary font-bold tabular-nums">{d.count}</span>
                </div>
            ))}
        </div>
    );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
            <span className="text-[11px] uppercase tracking-wide text-text-dim">{label}</span>
            <span className="font-serif text-2xl font-black text-text">{value}</span>
        </div>
    );
}

export default function Developer() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('analytics');

    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);

    const [query, setQuery] = useState('');
    const [candidates, setCandidates] = useState<TesterCandidate[]>([]);
    const [searching, setSearching] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [reviewingId, setReviewingId] = useState<string | null>(null);

    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    const isOwner = !!user && user.email === import.meta.env.VITE_OWNER_EMAIL;

    useEffect(() => {
        if (!isOwner) return;
        api.get<Analytics | ErrorResponse>('/api/dev/analytics').then(data => {
            if ('error' in data) setAnalyticsError(data.error);
            else setAnalytics(data);
        });
    }, [isOwner]);

    useEffect(() => {
        if (!isOwner) return;
        api.get<FeedbackItem[] | ErrorResponse>('/api/feedback').then(data => {
            if (!Array.isArray(data) && 'error' in data) setFeedbackError(data.error);
            else setFeedbackItems(Array.isArray(data) ? data : []);
        });
    }, [isOwner]);

    const markFeedbackReviewed = async (id: string) => {
        setReviewingId(id);
        try {
            const res = await api.post<Partial<ErrorResponse>>(`/api/feedback/${id}/reviewed`, {});
            if (res.error) {
                showError(res.error);
                return;
            }
            setFeedbackItems(prev => prev.filter(f => f.id !== id));
            showOk('Marked as reviewed.');
        } finally {
            setReviewingId(null);
        }
    };

    const runSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) {
            setCandidates([]);
            return;
        }
        setSearching(true);
        try {
            const data = await api.get<TesterCandidate[] | ErrorResponse>(`/api/dev/testers/search?q=${encodeURIComponent(query.trim())}`);
            setCandidates(Array.isArray(data) ? data : []);
        } finally {
            setSearching(false);
        }
    };

    const toggleTester = async (candidate: TesterCandidate) => {
        setTogglingId(candidate.id);
        try {
            const res = await api.post<ToggleTesterResponse | ErrorResponse>(`/api/dev/testers/${candidate.id}/toggle`, {});
            if ('error' in res) {
                showError(res.error);
                return;
            }
            setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, is_tester: res.is_tester } : c));
            showOk(res.is_tester ? `${candidate.username} is now a tester.` : `${candidate.username} is no longer a tester.`);
        } finally {
            setTogglingId(null);
        }
    };

    const downloadExport = async (table: string, format: 'json' | 'csv') => {
        try {
            const res = await fetch(`${BASE}/api/dev/export/${table}${format === 'csv' ? '?format=csv' : ''}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) {
                showError('Export failed.');
                return;
            }
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `${table}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            showError('Export failed. Check your connection.');
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center px-6 text-center">
                <div className="text-text-dim text-sm">Log in to view this page.</div>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Owner only</div>
                <div className="text-sm text-text-dim">This page isn't available on your account.</div>
            </div>
        );
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: 'analytics', label: 'Analytics' },
        { id: 'export', label: 'Export' },
        { id: 'testers', label: 'Testers' },
        { id: 'feedback', label: 'Feedback' },
        { id: 'docs', label: 'API Docs' },
    ];

    return (
        <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-12">
            {toast && <Toast {...toast} />}

            <div className="max-w-[900px] mx-auto flex flex-col gap-5">
                <h1 className="font-serif text-2xl font-black text-text">Developer</h1>

                <div className="flex gap-2 flex-wrap border-b border-border pb-3">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide cursor-pointer border transition-colors ${
                                tab === t.id
                                    ? 'bg-accent/15 text-accent border-accent/40'
                                    : 'bg-surface text-text-dim border-border hover:text-text-secondary'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'analytics' && (
                    <div className="flex flex-col gap-6">
                        {analyticsError && <div className="text-sm text-danger">{analyticsError}</div>}
                        {!analytics && !analyticsError && <div className="text-sm text-text-dim">Loading analytics...</div>}
                        {analytics && (
                            <>
                                <div className="flex gap-3 flex-wrap">
                                    <StatTile label="Verified users" value={analytics.verification.verified} />
                                    <StatTile label="Unverified users" value={analytics.verification.unverified} />
                                </div>

                                <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                                    <div className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
                                        <h2 className="text-sm font-bold text-text-secondary">Signups / day (30d)</h2>
                                        <BarRows data={analytics.signups_per_day} />
                                    </div>
                                    <div className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
                                        <h2 className="text-sm font-bold text-text-secondary">Problems added / day (30d)</h2>
                                        <BarRows data={analytics.problems_per_day} />
                                    </div>
                                    <div className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
                                        <h2 className="text-sm font-bold text-text-secondary">Sends / day (30d)</h2>
                                        <BarRows data={analytics.sends_per_day} />
                                    </div>
                                </div>

                                <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                                    <div className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
                                        <h2 className="text-sm font-bold text-text-secondary">Top sent problems</h2>
                                        {analytics.top_problems.length === 0 ? (
                                            <div className="text-xs text-text-dim italic">No sends yet.</div>
                                        ) : (
                                            <ol className="flex flex-col gap-1.5 text-sm">
                                                {analytics.top_problems.map((p, i) => (
                                                    <li key={p.id} className="flex justify-between gap-3 text-text-secondary">
                                                        <span>{i + 1}. {p.name}</span>
                                                        <span className="text-accent font-bold">{p.sends}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>
                                    <div className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
                                        <h2 className="text-sm font-bold text-text-secondary">Most active users</h2>
                                        {analytics.active_users.length === 0 ? (
                                            <div className="text-xs text-text-dim italic">No activity yet.</div>
                                        ) : (
                                            <ol className="flex flex-col gap-1.5 text-sm">
                                                {analytics.active_users.map((u, i) => (
                                                    <li key={u.user_id} className="flex justify-between gap-3 text-text-secondary">
                                                        <span>{i + 1}. {u.username || 'Climber'}</span>
                                                        <span className="text-text-dim text-xs">
                                                            {u.sends} sends &middot; {u.comments} comments &middot; {u.problems} added
                                                        </span>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'export' && (
                    <div className="flex flex-col gap-3">
                        {EXPORT_TABLES.map(table => (
                            <div key={table} className="bg-panel border border-border rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                                <span className="text-sm font-bold text-text capitalize">{table}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => downloadExport(table, 'json')}
                                        className="px-3 py-2 bg-surface border border-border text-text-dim rounded-lg text-xs cursor-pointer hover:text-text transition-colors"
                                    >
                                        Download JSON
                                    </button>
                                    <button
                                        onClick={() => downloadExport(table, 'csv')}
                                        className="px-3 py-2 bg-surface border border-border text-text-dim rounded-lg text-xs cursor-pointer hover:text-text transition-colors"
                                    >
                                        Download CSV
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'testers' && (
                    <div className="flex flex-col gap-4">
                        <form onSubmit={runSearch} className="flex gap-2">
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by username or email"
                                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent"
                            />
                            <button
                                type="submit"
                                disabled={searching}
                                className="px-4 py-2 bg-accent/15 text-accent border border-accent/40 rounded-lg text-xs font-bold uppercase cursor-pointer disabled:opacity-50"
                            >
                                Search
                            </button>
                        </form>

                        <div className="flex flex-col gap-2">
                            {candidates.map(c => (
                                <div key={c.id} className="bg-panel border border-border rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-text font-bold">{c.username}</span>
                                        <span className="text-xs text-text-dim">{c.email}</span>
                                    </div>
                                    <button
                                        onClick={() => toggleTester(c)}
                                        disabled={togglingId === c.id}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold uppercase cursor-pointer border transition-colors disabled:opacity-50 ${
                                            c.is_tester
                                                ? 'bg-accent/15 text-accent border-accent/40'
                                                : 'bg-surface text-text-dim border-border hover:text-text-secondary'
                                        }`}
                                    >
                                        {c.is_tester ? 'Tester' : 'Not a tester'}
                                    </button>
                                </div>
                            ))}
                            {candidates.length === 0 && query.trim() && !searching && (
                                <div className="text-xs text-text-dim italic">No matches.</div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'feedback' && (
                    <div className="flex flex-col gap-3">
                        {feedbackError && <div className="text-sm text-danger">{feedbackError}</div>}
                        {!feedbackError && feedbackItems.length === 0 && (
                            <div className="text-sm text-text-dim italic">No open feedback.</div>
                        )}
                        {feedbackItems.map(f => (
                            <div key={f.id} className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-2">
                                <div className="text-sm text-text whitespace-pre-wrap">{f.message}</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
                                    <span>{f.username ? `@${f.username}` : f.email || 'Anonymous'}</span>
                                    {f.page_url && <span>{f.page_url}</span>}
                                    <span>{new Date(f.created_at).toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => markFeedbackReviewed(f.id)}
                                    disabled={reviewingId === f.id}
                                    className="self-start px-3 py-2 bg-surface border border-border text-text-dim rounded-lg text-xs cursor-pointer hover:text-text transition-colors disabled:opacity-50"
                                >
                                    {reviewingId === f.id ? 'Marking...' : 'Mark reviewed'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'docs' && (
                    <div className="bg-panel border border-border rounded-2xl overflow-x-auto">
                        <table className="w-full text-sm border-collapse min-w-[640px]">
                            <thead>
                                <tr className="border-b border-border text-left text-text-dim text-xs uppercase">
                                    <th className="p-3">Method</th>
                                    <th className="p-3">Route</th>
                                    <th className="p-3">Auth</th>
                                    <th className="p-3">Purpose</th>
                                </tr>
                            </thead>
                            <tbody>
                                {API_DOCS.map(doc => (
                                    <tr key={`${doc.method} ${doc.route}`} className="border-b border-border/60 last:border-0">
                                        <td className="p-3 text-accent font-bold">{doc.method}</td>
                                        <td className="p-3 text-text-secondary font-mono text-xs">{doc.route}</td>
                                        <td className="p-3 text-text-dim">{doc.auth}</td>
                                        <td className="p-3 text-text-dim">{doc.purpose}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
