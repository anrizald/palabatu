import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/useAuth.js';
import Toast, { type ToastProps } from '../components/Toast.js';
import type { MergeRequestListItem, ResolveMergeRequestRequest } from '../types/boulder.js';
import type { ErrorResponse } from '../types/apitypes.js';

const HOLD_MS = 48 * 60 * 60 * 1000;

// Admin-only review queue for "these are the same rock" suggestions --
// modeled directly on AdminReports.tsx's shape (no client-side role check,
// the admin-only endpoint's response itself is the signal: a non-array
// means "not an admin"). Objections are shown prominently on each request,
// never a footnote (handoff.md merge design note 4) -- the decision is
// still the admin's either way.
export default function AdminMergeRequests() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<MergeRequestListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [survivorChoice, setSurvivorChoice] = useState<Record<string, 'source' | 'target'>>({});
    const [overrideHold, setOverrideHold] = useState<Record<string, boolean>>({});

    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    useEffect(() => {
        if (!user) { setIsLoading(false); return; }
        api.get<MergeRequestListItem[] | ErrorResponse>('/api/boulders/merge-requests').then(data => {
            if (Array.isArray(data)) {
                setRequests(data);
            } else {
                setLoadError(data.error || 'Could not load merge requests.');
            }
            setIsLoading(false);
        });
    }, [user]);

    const handleResolve = async (req: MergeRequestListItem, action: 'merge' | 'reject') => {
        if (action === 'merge') {
            const choice = survivorChoice[req.id] ?? 'source';
            const survivorId = choice === 'source' ? req.source_boulder_id : req.target_boulder_id;
            if (!window.confirm('Combine these two rocks? This moves every problem from the losing rock onto the survivor.')) return;

            setResolvingId(req.id);
            const body: ResolveMergeRequestRequest = { action: 'merge', survivor_id: survivorId, override_hold: overrideHold[req.id] ?? false };
            const res = await api.post<Partial<ErrorResponse>>(`/api/boulders/merge-requests/${req.id}/resolve`, body);
            setResolvingId(null);
            if (res.error) { showError(res.error); return; }
            setRequests(prev => prev.filter(r => r.id !== req.id));
            showOk('Two rocks were combined.');
            return;
        }

        setResolvingId(req.id);
        const body: ResolveMergeRequestRequest = { action: 'reject', survivor_id: '', override_hold: false };
        const res = await api.post<Partial<ErrorResponse>>(`/api/boulders/merge-requests/${req.id}/resolve`, body);
        setResolvingId(null);
        if (res.error) { showError(res.error); return; }
        setRequests(prev => prev.filter(r => r.id !== req.id));
        showOk('Suggestion not accepted.');
    };

    if (!user) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex items-center justify-center px-6 text-center">
                <div className="text-text-dim text-sm">Log in as an admin to view the merge queue.</div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading...</div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Admins only</div>
                <div className="text-sm text-text-dim">{loadError}</div>
            </div>
        );
    }

    return (
        <div className="min-h-[var(--content-h)] bg-ink font-sans px-6 pt-6 pb-12">
            {toast && <Toast {...toast} />}

            <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                <h1 className="font-serif text-2xl font-black text-text">Same-Rock Suggestions</h1>

                {requests.length === 0 ? (
                    <div className="text-sm text-text-dim italic">No pending suggestions.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {requests.map(req => {
                            const holdActive = Date.now() - new Date(req.created_at).getTime() < HOLD_MS;
                            const choice = survivorChoice[req.id] ?? 'source';
                            const canMerge = !holdActive || (overrideHold[req.id] ?? false);
                            return (
                                <div key={req.id} className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Link to={`/boulders/${req.source_boulder_id}`} className="text-accent font-bold no-underline hover:underline">
                                                {req.source_boulder_name ?? 'Unnamed rock'}
                                            </Link>
                                            <span className="text-text-dim">vs</span>
                                            <Link to={`/boulders/${req.target_boulder_id}`} className="text-accent font-bold no-underline hover:underline">
                                                {req.target_boulder_name ?? 'Unnamed rock'}
                                            </Link>
                                        </div>
                                        <span className="text-text-dim text-xs">{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>

                                    <div className="text-xs text-text-dim">
                                        Suggested by {req.suggester_name || 'unknown'}
                                        {req.reason && <span> -- "{req.reason}"</span>}
                                    </div>

                                    {req.objections.length > 0 && (
                                        <div className="bg-danger/5 border border-danger/25 rounded-xl p-3 flex flex-col gap-1.5">
                                            <div className="text-[11px] text-danger uppercase tracking-wide">Objections</div>
                                            {req.objections.map(o => (
                                                <div key={o.id} className="text-xs text-text-secondary">
                                                    <b>{o.username ?? 'Someone'}</b>: "{o.body}"
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 flex-wrap text-xs text-text-dim">
                                        <span>Keep:</span>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" checked={choice === 'source'} onChange={() => setSurvivorChoice(prev => ({ ...prev, [req.id]: 'source' }))} />
                                            {req.source_boulder_name ?? 'Unnamed rock'}
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="radio" checked={choice === 'target'} onChange={() => setSurvivorChoice(prev => ({ ...prev, [req.id]: 'target' }))} />
                                            {req.target_boulder_name ?? 'Unnamed rock'}
                                        </label>
                                    </div>

                                    {holdActive && (
                                        <label className="flex items-center gap-1.5 text-xs text-text-dim cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={overrideHold[req.id] ?? false}
                                                onChange={e => setOverrideHold(prev => ({ ...prev, [req.id]: e.target.checked }))}
                                            />
                                            Override the 48h objection window (obvious cases only)
                                        </label>
                                    )}

                                    <div className="flex gap-3 pt-1 border-t border-border">
                                        <button
                                            onClick={() => handleResolve(req, 'reject')}
                                            disabled={resolvingId === req.id}
                                            className="flex-1 mt-3 py-2 bg-surface border border-border text-text-dim rounded-lg text-xs cursor-pointer hover:text-text transition-colors disabled:opacity-50"
                                        >
                                            Not the same rock
                                        </button>
                                        <button
                                            onClick={() => handleResolve(req, 'merge')}
                                            disabled={resolvingId === req.id || !canMerge}
                                            title={!canMerge ? 'Objection window still open -- override to combine early' : undefined}
                                            className="flex-1 mt-3 py-2 bg-accent/10 border border-accent/40 text-accent rounded-lg text-xs cursor-pointer hover:bg-accent/15 transition-colors disabled:opacity-50"
                                        >
                                            Combine these rocks
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
