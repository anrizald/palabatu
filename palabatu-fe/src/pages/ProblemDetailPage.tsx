import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/useAuth.js';
import { useIsAdmin } from '../lib/useIsAdmin.js';
import Toast, { type ToastProps } from '../components/Toast.js';
import HorizontalScrollCarousel from '../components/HorizontalScrollCarousel.js';
import ProblemEditForm from '../components/ProblemEditForm.js';
import PinpointMarker from '../components/PinpointMarker.js';
import InfoTooltip, { ADDED_BY_DISCLAIMER } from '../components/InfoTooltip.js';
import ReportModal, { type ReportTarget } from '../components/ReportModal.js';
import TopoImage from '../components/topo-annotations/TopoImage.js';
import RockPicker from '../components/add-sheet/RockPicker.js';
import { invalidateCragCache } from '../lib/cragCache.js';
import type { AnnotationRecord, Shape } from '../types/annotation.js';
import type { ProblemDetail, ProblemRow, UpdateProblemRequest, TopoUploadResponse } from '../types/problem.js';
import type { BoulderListItem } from '../types/boulder.js';
import type { CragListItem } from '../types/crag.js';
import type { Comment, SendStatusResponse, ActionResponse } from '../types/social.js';
import type { ErrorResponse } from '../types/apitypes.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { MapPin, Calendar, Share2, ArrowLeft, Flame, Compass, X, GitCompare } from 'lucide-react';
import { RecenterButton, ZoomControlButtons } from '../components/MapControls.js';

const HIGHBALL_THRESHOLD_M = 4.5

type NearbyProblem = {
    id: string;
    name: string;
    grade: string | null;
    boulder_name: string | null;
};

function formatDate(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Rows for the "more details" block -- decision 10: one height field, the
// "highball" label derived here at a threshold rather than stored as a
// second flag that could drift out of sync with height_m.
function detailRows(problem: ProblemDetail): { label: string; value: string }[] {
    const rows: { label: string; value: string }[] = [];
    if (problem.first_ascensionist) rows.push({ label: 'First ascent', value: problem.first_ascensionist });
    if (problem.discovered_by && problem.discovered_by !== problem.first_ascensionist) {
        rows.push({ label: 'Discovered by', value: problem.discovered_by });
    }
    if (problem.landing_hazards) rows.push({ label: 'Landing / spotting', value: problem.landing_hazards });
    if (problem.descent) rows.push({ label: 'Descent', value: problem.descent });
    if (problem.height_m != null) {
        const highball = problem.height_m >= HIGHBALL_THRESHOLD_M ? ' -- highball' : '';
        rows.push({ label: 'Height', value: `${problem.height_m} m${highball}` });
    }
    return rows;
}

export default function ProblemDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const isAdmin = useIsAdmin();
    const navigate = useNavigate();

    const [problem, setProblem] = useState<ProblemDetail | null>(null);
    const [boulder, setBoulder] = useState<BoulderListItem | null>(null);
    const [crag, setCrag] = useState<CragListItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', grade: '', first_ascensionist: '', discovered_by: '',
        landing_hazards: '', descent: '', height_m: '', notes: '',
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const [sendCount, setSendCount] = useState(0);
    const [hasSent, setHasSent] = useState(false);
    const [isTogglingSend, setIsTogglingSend] = useState(false);

    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [annotationsByUrl, setAnnotationsByUrl] = useState<Record<string, Shape[]>>({});
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);

    const [nearby, setNearby] = useState<NearbyProblem[]>([]);

    const [showMoveRock, setShowMoveRock] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const [isUploadingBeta, setIsUploadingBeta] = useState(false);
    const [removingBetaUrl, setRemovingBetaUrl] = useState<string | null>(null);

    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    const isCreator = !!user && !!problem && user.id === problem.created_by;
    const canEdit = isCreator || isAdmin;

    useEffect(() => {
        if (!id) return;
        setIsLoading(true);
        setLoadError(null);

        api.get<ProblemDetail | ErrorResponse>(`/api/problems/${id}`).then(async data => {
            if ('error' in data) {
                setLoadError(data.error || 'This problem could not be found.');
                setIsLoading(false);
                return;
            }
            setProblem(data);
            setSendCount(data.send_count || 0);
            setEditForm({
                name: data.name,
                grade: data.grade || '',
                first_ascensionist: data.first_ascensionist || '',
                discovered_by: data.discovered_by || '',
                landing_hazards: data.landing_hazards || '',
                descent: data.descent || '',
                height_m: data.height_m != null ? String(data.height_m) : '',
                notes: data.notes || '',
            });

            const [boulderRes, cragRes] = await Promise.all([
                api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${data.boulder_id}`),
                api.get<CragListItem | ErrorResponse>(`/api/crags/${data.crag_id}`),
            ]);
            if (!('error' in boulderRes)) setBoulder(boulderRes);
            if (!('error' in cragRes)) setCrag(cragRes);

            setIsLoading(false);
        });

        api.get<Comment[] | ErrorResponse>(`/api/problems/${id}/comments`).then(data => {
            if (Array.isArray(data)) setComments(data);
        });

        api.get<AnnotationRecord[] | ErrorResponse>(`/api/problems/${id}/annotations`).then(rows => {
            if (Array.isArray(rows)) {
                setAnnotationsByUrl(Object.fromEntries(rows.map(r => [r.image_url, r.data])));
            }
        });
    }, [id]);

    useEffect(() => {
        if (!id || !user) return;
        api.get<SendStatusResponse | ErrorResponse>(`/api/problems/${id}/send-status`).then(data => {
            if (!('error' in data)) setHasSent(data.hasSent);
        });
    }, [id, user]);

    // Real crag join now, replacing the old free-text location_name match
    // (ROADMAP.md's Phase 1.5 note).
    useEffect(() => {
        if (!problem?.crag_id) return;
        api.get<NearbyProblem[] | ErrorResponse>(`/api/problems?crag_id=${problem.crag_id}`).then((data) => {
            if (Array.isArray(data)) {
                setNearby(data.filter(p => p.id !== problem.id).slice(0, 5));
            }
        });
    }, [problem?.crag_id, problem?.id]);

    const handleToggleSend = async () => {
        if (!id) return;
        setIsTogglingSend(true);
        try {
            const res = await api.post<ActionResponse | ErrorResponse>(`api/problems/${id}/send`, {});
            if ('action' in res && res.action === 'added') {
                setHasSent(true);
                setSendCount(prev => prev + 1);
            } else if ('action' in res && res.action === 'removed') {
                setHasSent(false);
                setSendCount(prev => prev - 1);
            }
        } catch (e) {
            console.error('Failed to toggle send', e);
            showError('Failed to log send. Check your connection.');
        } finally {
            setIsTogglingSend(false);
        }
    };

    const handleSave = async () => {
        if (!id) return;
        setIsProcessing(true);
        try {
            const body: UpdateProblemRequest = {
                boulder_id: '',
                name: editForm.name, grade: editForm.grade,
                first_ascensionist: editForm.first_ascensionist, discovered_by: editForm.discovered_by,
                landing_hazards: editForm.landing_hazards, descent: editForm.descent,
                height_m: editForm.height_m.trim() ? Number(editForm.height_m) : null,
                notes: editForm.notes,
            };
            const data = await api.put<Partial<ErrorResponse>>(`/api/problems/${id}`, body);
            if (data.error) {
                showError(`Error updating: ${data.error}`);
            } else {
                setProblem(prev => prev ? { ...prev, ...body } : prev);
                setIsEditing(false);
                showOk('Problem updated!');
            }
        } catch (e) {
            console.error('Update failed', e);
            showError('Failed to update problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    // "Move to another rock" -- the missing inverse of "not sure which
    // rock" (handoff.md decision 13): filed against the wrong rock at the
    // right spot is a real, common error, and until now the only fix was
    // delete-and-recreate, which loses sends/comments/annotations. Only
    // offered within the problem's own crag (its motivating case is a
    // same-spot misfile, not a cross-spot move -- that's the boulder-level
    // "move to another spot" on BoulderDetailPage).
    const handleMoveToRock = async (target: BoulderListItem) => {
        if (!id || !problem) return;
        if (!window.confirm(`Move "${problem.name}" to ${target.name ?? 'this rock'}? Any line drawn on the old rock's photo will be dropped -- it wouldn't mean anything on the new one.`)) return;
        setIsMoving(true);
        try {
            const body: UpdateProblemRequest = {
                boulder_id: target.id,
                name: problem.name, grade: problem.grade ?? '',
                first_ascensionist: problem.first_ascensionist ?? '', discovered_by: problem.discovered_by ?? '',
                landing_hazards: problem.landing_hazards ?? '', descent: problem.descent ?? '',
                height_m: problem.height_m, notes: problem.notes ?? '',
            };
            const res = await api.put<ProblemDetail | Partial<ErrorResponse>>(`/api/problems/${id}`, body);
            if ('error' in res && res.error) {
                showError(res.error);
            } else {
                invalidateCragCache();
                setShowMoveRock(false);
                showOk('Moved to the new rock.');
                setAnnotationsByUrl({});
                setBoulder(target);
                setProblem(prev => prev ? { ...prev, boulder_id: target.id, boulder_name: target.name ?? null } : prev);
            }
        } finally {
            setIsMoving(false);
        }
    };

    // Beta/action shots (handoff.md decision 2, amended) -- the crux hold,
    // the start position, someone on it. Never the topo base (that's the
    // rock's, above) and never annotatable: a line on an action shot would
    // be a second, competing representation of the same route.
    const handleAddBetaPhotos = async (files: File[]) => {
        if (!id || files.length === 0) return;
        setIsUploadingBeta(true);
        try {
            const uploads = await Promise.all(files.map(file => {
                const formData = new FormData();
                formData.append('image', file);
                return api.upload<Partial<TopoUploadResponse & ErrorResponse>>('/api/upload/topo', formData);
            }));
            const uploadedUrls = uploads.filter((r): r is TopoUploadResponse => !!r.url).map(r => r.url);
            if (uploadedUrls.length === 0) return;
            const res = await api.post<ProblemRow | ErrorResponse>(`/api/problems/${id}/images`, { image_urls: uploadedUrls });
            if ('error' in res) { showError(res.error); return; }
            setProblem(prev => prev ? { ...prev, image_urls: res.image_urls } : prev);
        } finally {
            setIsUploadingBeta(false);
        }
    };

    const handleRemoveBetaPhoto = async (url: string) => {
        if (!id || !window.confirm('Remove this photo?')) return;
        setRemovingBetaUrl(url);
        const res = await api.delete<Partial<ErrorResponse>>(`/api/problems/${id}/images`, { url });
        setRemovingBetaUrl(null);
        if (res.error) { showError(res.error); return; }
        setProblem(prev => prev ? { ...prev, image_urls: prev.image_urls.filter(u => u !== url) } : prev);
    };

    const handleDelete = async () => {
        if (!id || !problem || !window.confirm('Are you sure you want to delete this problem?')) return;
        setIsProcessing(true);
        try {
            const res = await api.delete<Partial<ErrorResponse>>(`/api/problems/${id}`);
            if (res.error) {
                showError(`Error deleting: ${res.error}`);
            } else {
                navigate(`/boulders/${problem.boulder_id}`);
            }
        } catch (e) {
            console.error('Delete failed', e);
            showError('Failed to delete problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePostComment = async () => {
        if (!id || !newComment.trim()) return;
        setIsPostingComment(true);
        try {
            const data = await api.post<Comment | ErrorResponse>(`/api/problems/${id}/comments`, { content: newComment });
            if ('error' in data) {
                showError(data.error);
            } else {
                setComments(prev => [...prev, data]);
                setNewComment('');
            }
        } catch (e) {
            console.error(e);
            showError('Failed to post comment. Are you logged in?');
        } finally {
            setIsPostingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm('Delete this comment?')) return;
        setDeletingCommentId(commentId);
        try {
            const res = await api.delete<Partial<ErrorResponse>>(`/api/comments/${commentId}`);
            if (res.error) {
                showError(`Error deleting: ${res.error}`);
            } else {
                setComments(prev => prev.filter(c => c.id !== commentId));
            }
        } catch (e) {
            console.error('Comment delete failed', e);
            showError('Failed to delete comment. Check your connection.');
        } finally {
            setDeletingCommentId(null);
        }
    };

    const submitReport = async (reason: string) => {
        if (!id || !reportTarget) return;
        setIsSubmittingReport(true);

        try {
            const res = reportTarget.type === 'comment'
                ? await api.post<Partial<ErrorResponse>>(`/api/comments/${reportTarget.id}/report`, { reason })
                : await api.post<Partial<ErrorResponse>>(`/api/problems/${id}/images/report`, { url: reportTarget.url, reason });

            if (res.error) {
                showError(`Error: ${res.error}`);
            } else {
                showOk(`${reportTarget.type === 'comment' ? 'Comment' : 'Image'} reported. Thanks for flagging it.`);
                setReportTarget(null);
            }
        } catch (e) {
            console.error('Report failed', e);
            showError('Failed to submit report. Check your connection.');
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            showOk('Link copied to clipboard!');
        } catch (e) {
            console.error('Copy failed', e);
            showError('Could not copy the link.');
        }
    };

    const joinDate = useMemo(() => problem ? formatDate(problem.created_at) : null, [problem]);

    // A problem has no location of its own -- plot its boulder's point if
    // set, else fall back to the crag's (always present, handoff.md
    // decision 4).
    const markerPosition = useMemo<[number, number] | null>(() => {
        if (boulder?.lat != null && boulder?.lng != null) return [boulder.lat, boulder.lng];
        if (crag) return [crag.lat, crag.lng];
        return null;
    }, [boulder, crag]);

    const rows = useMemo(() => problem ? detailRows(problem) : [], [problem]);

    if (isLoading) return (
        <div className="min-h-[var(--content-h)] bg-ink flex items-center justify-center">
            <div className="text-text-muted font-serif tracking-wider">Loading problem...</div>
        </div>
    );

    if (loadError || !problem) return (
        <div className="min-h-[var(--content-h)] bg-ink flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="font-serif text-2xl font-black text-text">Problem not found</div>
            <div className="text-sm text-text-dim">{loadError}</div>
            <Link to="/directory" className="mt-2 text-sm text-accent hover:underline">Back to the directory</Link>
        </div>
    );

    const photos = boulder?.image_urls ?? [];

    return (
        <>
            {toast && <Toast {...toast} />}
            {reportTarget && (
                <ReportModal
                    target={reportTarget}
                    onClose={() => setReportTarget(null)}
                    onSubmit={submitReport}
                    isSubmitting={isSubmittingReport}
                />
            )}

            {showMoveRock && problem && (
                <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="relative bg-panel border border-border rounded-t-[20px] sm:rounded-[20px] w-full sm:max-w-[440px] max-h-[85dvh] flex flex-col overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] font-sans">
                        <div className="shrink-0 flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
                            <h2 className="font-serif text-lg font-bold text-text">Move to another rock</h2>
                            <button onClick={() => setShowMoveRock(false)} aria-label="Close" disabled={isMoving} className="w-11 h-11 -m-1.5 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                                <X size={20} className="shrink-0" />
                            </button>
                        </div>
                        <p className="px-5 pt-3 text-xs text-text-muted">Filed against the wrong rock at {crag?.name ?? 'this spot'}? Pick the right one -- any drawn line is dropped, not moved.</p>
                        <div className="flex-1 overflow-y-auto px-5 pb-4">
                            <RockPicker
                                cragId={problem.crag_id}
                                excludeBoulderId={problem.boulder_id}
                                onPick={handleMoveToRock}
                                onNewRock={() => showError('Add a new rock from the map first, then move this problem to it.')}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-[var(--content-h)] bg-ink font-sans px-6 pt-6 pb-12">
                <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                    <Link to="/directory" className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors w-fit">
                        <ArrowLeft size={14} className="shrink-0" /> Back to Directory
                    </Link>

                    {/* Hero */}
                    <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                        {photos.length > 0 && (
                            <HorizontalScrollCarousel itemCount={photos.length} outerMarginX={0} paddingX={0}>
                                {photos.map((url, i) => (
                                    <div key={i} className="shrink-0" style={{ scrollSnapAlign: 'center' }}>
                                        <TopoImage
                                            problemId={problem.id}
                                            url={url}
                                            shapes={annotationsByUrl[url] ?? []}
                                            canEdit={canEdit}
                                            canReport={!!user}
                                            onReport={() => setReportTarget({ type: 'image', url })}
                                            onSaved={(shapes) => setAnnotationsByUrl(prev => ({ ...prev, [url]: shapes }))}
                                            className="h-[320px] w-full max-w-[820px]"
                                        />
                                    </div>
                                ))}
                            </HorizontalScrollCarousel>
                        )}

                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h1 className="font-serif text-[28px] font-black text-text leading-tight">{problem.name}</h1>
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                        <span className="bg-accent/15 text-accent px-3.5 py-1.5 rounded-full text-[13px] font-bold">
                                            {problem.grade || 'Ungraded'}
                                        </span>
                                        {problem.crag_name && (
                                            <Link to={`/crags/${problem.crag_id}`} className="flex items-center gap-1 text-xs text-text-dim no-underline hover:text-accent">
                                                <Compass size={12} className="shrink-0" /> {problem.crag_name}
                                            </Link>
                                        )}
                                        {problem.boulder_name && (
                                            <Link to={`/boulders/${problem.boulder_id}`} className="flex items-center gap-1 text-xs text-text-dim no-underline hover:text-accent">
                                                <MapPin size={12} className="shrink-0" /> {problem.boulder_name}
                                            </Link>
                                        )}
                                        {joinDate && (
                                            <span className="flex items-center gap-1 text-xs text-text-dim">
                                                <Calendar size={12} className="shrink-0" /> {joinDate}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleShare}
                                    title="Copy link"
                                    className="shrink-0 bg-transparent border border-border hover:border-accent text-text-dim hover:text-accent p-2.5 rounded-xl transition-colors cursor-pointer"
                                >
                                    <Share2 size={16} />
                                </button>
                            </div>

                            <div className="text-xs text-text-dim flex items-center gap-1.5">
                                <span>
                                    Added by{' '}
                                    <Link to={`/profile/${problem.creator_slug}`} className="text-accent font-bold no-underline hover:underline">
                                        {problem.creator_name || 'unknown'}
                                    </Link>
                                    {' '}in Palabatu
                                </span>
                                <InfoTooltip text={ADDED_BY_DISCLAIMER} />
                            </div>

                            {rows.length > 0 && (
                                <div className="flex flex-col gap-1.5 bg-ink/50 rounded-xl border border-border p-3.5">
                                    {rows.map(row => (
                                        <div key={row.label} className="flex items-baseline gap-2 text-xs">
                                            <span className="text-text-dim w-[120px] shrink-0">{row.label}</span>
                                            <span className="text-text-secondary">{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {problem.notes && (
                                <p className="text-sm text-text-secondary leading-relaxed">{problem.notes}</p>
                            )}

                            {(problem.image_urls.length > 0 || canEdit) && (
                                <div className="flex flex-col gap-2">
                                    <div className="text-[11px] text-text-dim tracking-[0.1em] uppercase">Beta &amp; action shots</div>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {problem.image_urls.map(url => (
                                            <div key={url} className="relative min-w-[110px] h-[110px] rounded-lg overflow-hidden shrink-0 border border-border">
                                                <img src={url} className="w-full h-full object-cover" alt="Beta" />
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleRemoveBetaPhoto(url)}
                                                        disabled={removingBetaUrl === url}
                                                        className="absolute top-1 right-1 bg-black/60 text-white border-0 rounded-full w-6 h-6 cursor-pointer flex items-center justify-center disabled:opacity-50"
                                                        aria-label="Remove photo"
                                                    ><X size={13} className="shrink-0" /></button>
                                                )}
                                            </div>
                                        ))}
                                        {canEdit && (
                                            <label className={`min-w-[110px] h-[110px] bg-surface border border-dashed border-text-faint rounded-lg cursor-pointer flex flex-col items-center justify-center text-text-dim text-xl shrink-0 ${isUploadingBeta ? 'opacity-50' : ''}`}>
                                                +
                                                <span className="text-[10px] mt-1">{isUploadingBeta ? 'Uploading...' : 'Add photo'}</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    disabled={isUploadingBeta}
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const files = Array.from(e.target.files || []);
                                                        e.target.value = '';
                                                        handleAddBetaPhotos(files);
                                                    }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={handleToggleSend}
                                    disabled={isTogglingSend || !user}
                                    title={user ? undefined : 'Log in to log a send'}
                                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors
                                        ${hasSent ? 'bg-associate/15 border border-associate text-associate' : 'bg-accent text-on-accent border border-transparent'}
                                        ${isTogglingSend || !user ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <Flame size={14} className="shrink-0" /> {hasSent ? 'Sent!' : 'Log Send'}
                                </button>
                                <span className="text-xs text-text-dim">{sendCount} {sendCount === 1 ? 'send' : 'sends'}</span>
                            </div>

                            {canEdit && !isEditing && (
                                <div className="flex gap-3 pt-1 border-t border-border flex-wrap">
                                    <button onClick={() => setIsEditing(true)} className="flex-1 mt-3 py-2 bg-accent/10 border border-accent/25 text-accent rounded-lg text-xs cursor-pointer hover:bg-accent/15 transition-colors">Edit Details</button>
                                    <button onClick={() => setShowMoveRock(true)} className="flex-1 mt-3 py-2 bg-transparent border border-border text-text-muted rounded-lg text-xs cursor-pointer hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-1.5">
                                        <GitCompare size={13} className="shrink-0" /> Move to another rock
                                    </button>
                                    <button onClick={handleDelete} disabled={isProcessing} className="flex-1 mt-3 py-2 bg-danger/10 border border-danger/40 text-danger rounded-lg text-xs cursor-pointer hover:bg-danger/15 transition-colors disabled:opacity-50">Delete</button>
                                </div>
                            )}

                            {isEditing && (
                                <ProblemEditForm
                                    form={editForm}
                                    onChange={setEditForm}
                                    onSave={handleSave}
                                    onCancel={() => setIsEditing(false)}
                                    isProcessing={isProcessing}
                                />
                            )}
                        </div>
                    </div>

                    {/* Mini map -- a problem has no location of its own; this
                        plots its rock's point (or the spot's, if the rock has
                        none set). Editing location happens on the crag/boulder
                        page now, not here. */}
                    {markerPosition && (
                        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                            <div className="h-[220px]">
                                <MapContainer
                                    center={markerPosition}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={false}
                                    dragging={true}
                                    scrollWheelZoom={true}
                                    doubleClickZoom={true}
                                    touchZoom={true}
                                >
                                    <TileLayer
                                        attribution="Tiles &copy; Esri &mdash; Source: Esri"
                                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    />
                                    <PinpointMarker position={markerPosition} />
                                    <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1000 }}>
                                        <ZoomControlButtons />
                                    </div>
                                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000 }}>
                                        <RecenterButton position={markerPosition} />
                                    </div>
                                </MapContainer>
                            </div>
                        </div>
                    )}

                    {/* Nearby problems -- a real crag join now, replacing the
                        old free-text location_name grouping. */}
                    {nearby.length > 0 && (
                        <div className="bg-panel border border-border rounded-2xl p-5">
                            <div className="text-[11px] text-text-dim tracking-wide uppercase mb-3">Also at {problem.crag_name}</div>
                            <div className="flex flex-col gap-2">
                                {nearby.map(p => (
                                    <Link
                                        key={p.id}
                                        to={`/problems/${p.id}`}
                                        className="flex items-center justify-between gap-3 text-sm no-underline px-3 py-2 rounded-lg hover:bg-surface transition-colors"
                                    >
                                        <span className="text-text-secondary truncate">{p.name}{p.boulder_name ? ` -- ${p.boulder_name}` : ''}</span>
                                        {p.grade && <span className="text-xs text-accent shrink-0">{p.grade}</span>}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Comments / Beta */}
                    {!isEditing && (
                    <div className="bg-panel border border-border rounded-2xl p-5">
                        <h3 className="font-serif text-lg font-bold text-text mb-4">Beta & Comments</h3>

                        {user ? (
                            <div className="flex gap-2.5 mb-5">
                                <input
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                    placeholder="Share your beta..."
                                    className="flex-1 bg-surface border border-border focus:border-accent rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint outline-none transition-colors"
                                />
                                <button
                                    onClick={handlePostComment}
                                    disabled={isPostingComment || !newComment.trim()}
                                    className="bg-surface text-accent px-4 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {isPostingComment ? '...' : 'Post'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-sm text-text-dim italic mb-5">Log in to comment!</div>
                        )}

                        <div className="flex flex-col gap-3">
                            {comments.length === 0 ? (
                                <div className="text-sm text-text-dim italic">No beta yet. Be the first!</div>
                            ) : (
                                comments.map(comment => {
                                    const canDeleteComment = user && (user.id === comment.user_id || isAdmin);
                                    return (
                                        <div key={comment.id} className="text-sm text-text-secondary bg-ink/50 p-3 rounded-xl border border-border">
                                            <div className="flex justify-between items-center mb-1">
                                                <Link to={`/profile/${comment.user_slug}`} className="text-accent font-bold no-underline hover:underline">
                                                    {comment.username}
                                                </Link>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-text-dim text-[11px]">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                    {user && user.id !== comment.user_id && (
                                                        <button
                                                            onClick={() => setReportTarget({ type: 'comment', id: comment.id, content: comment.content })}
                                                            className="bg-transparent text-text-dim text-[11px] cursor-pointer"
                                                        >
                                                            Report
                                                        </button>
                                                    )}
                                                    {canDeleteComment && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            disabled={deletingCommentId === comment.id}
                                                            className="bg-transparent text-danger text-[11px] cursor-pointer disabled:opacity-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="leading-relaxed">{comment.content}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </>
    );
}
