import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.js';
import Toast, { type ToastProps } from '../components/Toast.js';

type Report = {
    id: string;
    reporter_id: string;
    reporter_name: string | null;
    problem_id: string;
    problem_name: string;
    target_type: 'comment' | 'image';
    comment_id: string | null;
    comment_content: string | null;
    image_url: string | null;
    reason: string | null;
    status: string;
    created_at: string;
};

export default function AdminReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }
        api.get('/api/reports').then(data => {
            if (Array.isArray(data)) {
                setReports(data);
            } else {
                setLoadError(data?.error || 'Could not load reports.');
            }
            setIsLoading(false);
        });
    }, [user]);

    const handleResolve = async (id: string, action: 'dismiss' | 'remove') => {
        if (action === 'remove' && !window.confirm('Remove this content? This cannot be undone.')) return;
        setResolvingId(id);
        try {
            const res = await api.post(`/api/reports/${id}/resolve`, { action });
            if (res.error) {
                showError(`Error: ${res.error}`);
            } else {
                setReports(prev => prev.filter(r => r.id !== id));
                showOk(action === 'dismiss' ? 'Report dismissed.' : 'Content removed.');
            }
        } catch (e) {
            console.error('Resolve failed', e);
            showError('Failed to resolve report. Check your connection.');
        } finally {
            setResolvingId(null);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center px-6 text-center">
                <div className="text-text-dim text-sm">Log in as an admin to view the reports queue.</div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading reports...</div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Admins only</div>
                <div className="text-sm text-text-dim">{loadError}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-12">
            {toast && <Toast {...toast} />}

            <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                <h1 className="font-serif text-2xl font-black text-text">Reports Queue</h1>

                {reports.length === 0 ? (
                    <div className="text-sm text-text-dim italic">No pending reports.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {reports.map(report => (
                            <div key={report.id} className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <span className="bg-accent/15 text-accent px-3 py-1 rounded-full text-xs font-bold uppercase">
                                        {report.target_type}
                                    </span>
                                    <Link to={`/problems/${report.problem_id}`} className="text-accent text-sm font-bold no-underline hover:underline">
                                        {report.problem_name}
                                    </Link>
                                    <span className="text-text-dim text-xs">{new Date(report.created_at).toLocaleDateString()}</span>
                                </div>

                                <div className="text-xs text-text-dim">
                                    Reported by {report.reporter_name || 'unknown'}
                                </div>

                                {report.target_type === 'comment' ? (
                                    <div className="text-sm text-text-secondary bg-ink/50 p-3 rounded-xl border border-border">
                                        {report.comment_content || <em className="text-text-dim">Comment already removed.</em>}
                                    </div>
                                ) : (
                                    report.image_url && (
                                        <img src={report.image_url} alt="Reported topo" className="h-[160px] w-full max-w-[300px] object-cover rounded-xl" />
                                    )
                                )}

                                {report.reason && (
                                    <div className="text-xs text-text-dim">Reason: {report.reason}</div>
                                )}

                                <div className="flex gap-3 pt-1 border-t border-border">
                                    <button
                                        onClick={() => handleResolve(report.id, 'dismiss')}
                                        disabled={resolvingId === report.id}
                                        className="flex-1 mt-3 py-2 bg-surface border border-border text-text-dim rounded-lg text-xs cursor-pointer hover:text-text transition-colors disabled:opacity-50"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => handleResolve(report.id, 'remove')}
                                        disabled={resolvingId === report.id}
                                        className="flex-1 mt-3 py-2 bg-danger/10 border border-danger/40 text-danger rounded-lg text-xs cursor-pointer hover:bg-danger/15 transition-colors disabled:opacity-50"
                                    >
                                        Remove content
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
