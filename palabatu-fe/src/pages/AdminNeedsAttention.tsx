import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, MapPin, HelpCircle, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/useAuth.js';
import type { NeedsAttentionItem } from '../types/boulder.js';
import type { ErrorResponse } from '../types/apitypes.js';

// Admin-only tidy-up queue (handoff.md open item 9), modeled on
// AdminMergeRequests.tsx: no client-side role check, the admin-only
// endpoint's response is itself the signal.
//
// UX principle 5 promises that a loosely-filed contribution gets tidied up
// later. This is the surface behind that promise -- and it deliberately
// does not act on anything itself. Every fix already exists on the rock's
// own page (name it, merge it, move its problem, delete it), and a queue
// that grew its own copies of those would be a second place for them to
// drift. So each row explains what it is, says what it is worth doing, and
// links to where it gets done.
export default function AdminNeedsAttention() {
    const { user } = useAuth();
    const [items, setItems] = useState<NeedsAttentionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) { setLoadError('Sign in as an admin to see this.'); setIsLoading(false); return; }
        api.get<NeedsAttentionItem[] | ErrorResponse>('/api/boulders/needs-attention').then(data => {
            if (!Array.isArray(data)) { setLoadError('error' in data ? data.error : 'Could not load'); setIsLoading(false); return; }
            setItems(data);
            setIsLoading(false);
        });
    }, [user]);

    if (isLoading) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading...</div>
            </div>
        );
    }

    // Matches AdminReports/AdminMergeRequests: an unauthorized visitor gets
    // "Admins only", never an empty list, which would otherwise read as
    // "nothing needs tidying" to someone who simply cannot see it.
    if (loadError) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Admins only</div>
                <div className="text-sm text-text-muted">{loadError}</div>
            </div>
        );
    }

    return (
        <div className="min-h-[var(--content-h)] bg-ink font-sans px-6 pt-6 pb-12">
            <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                <div>
                    <h1 className="font-serif text-2xl font-black text-text">Rocks to tidy</h1>
                    <p className="text-sm text-text-muted mt-1 leading-relaxed">
                        Rocks a problem was filed against loosely. Nothing here is broken, and none of it
                        is urgent. Open one to name it, combine it with the rock it really is, or move its
                        problem somewhere better.
                    </p>
                </div>

                {items.length === 0 && (
                    <div className="bg-panel border border-border rounded-2xl p-6 text-center">
                        <div className="text-text-secondary text-sm">Nothing needs tidying.</div>
                        <div className="text-text-muted text-xs mt-1">Every rock is either named, photographed, or holding more than one line.</div>
                    </div>
                )}

                {items.map(it => (
                    <div key={it.id} className="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                                <Link to={`/boulders/${it.id}`} className="font-serif text-lg font-bold text-accent no-underline hover:underline">
                                    {it.name ?? (it.sample_problem_name ? `The rock with ${it.sample_problem_name}` : 'Unnamed rock')}
                                </Link>
                                <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
                                    <MapPin size={12} className="shrink-0" />
                                    <Link to={`/crags/${it.crag_id}`} className="text-text-muted no-underline hover:underline">{it.crag_name}</Link>
                                </div>
                            </div>
                            <span
                                className={
                                    it.reason === 'said_unsure'
                                        ? 'text-[11px] px-2 py-1 rounded-full border border-accent/40 text-accent shrink-0'
                                        : 'text-[11px] px-2 py-1 rounded-full border border-border text-text-muted shrink-0'
                                }
                            >
                                {it.reason === 'said_unsure' ? 'They said they were not sure' : 'Looks uncertain'}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                            <span className="inline-flex items-center gap-1.5">
                                <Layers size={12} className="shrink-0" />
                                {it.problem_count} {it.problem_count === 1 ? 'problem' : 'problems'}
                            </span>
                            <span>{it.image_count === 0 ? 'no photo' : `${it.image_count} ${it.image_count === 1 ? 'photo' : 'photos'}`}</span>
                            {it.creator_name && <span>added by {it.creator_name}</span>}
                        </div>

                        <div className="border-t border-border pt-3 flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs text-text-secondary inline-flex items-center gap-1.5">
                                <HelpCircle size={13} className="shrink-0 text-text-muted" />
                                {it.sibling_count > 0
                                    ? `${it.sibling_count} other ${it.sibling_count === 1 ? 'rock' : 'rocks'} at this spot. It may be one of them.`
                                    : 'The only rock at this spot, so it just needs a name or a photo.'}
                            </span>
                            <Link
                                to={`/boulders/${it.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-muted no-underline inline-flex items-center gap-1.5 hover:bg-white/5 transition-colors shrink-0"
                            >
                                <Search size={13} className="shrink-0" /> Open the rock
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
