import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/useAuth.js';
import Toast, { type ToastProps } from '../components/Toast.js';
import HorizontalScrollCarousel from '../components/HorizontalScrollCarousel.js';
import ProblemEditForm from '../components/ProblemEditForm.js';
import PinpointMarker from '../components/PinpointMarker.js';
import InfoTooltip, { ADDED_BY_DISCLAIMER } from '../components/InfoTooltip.js';
import ReportModal, { type ReportTarget } from '../components/ReportModal.js';
import TopoImage from '../components/topo-annotations/TopoImage.js';
import type { AnnotationRecord, Shape } from '../types/annotation.js';
import type { ProblemDetail } from '../types/problem.js';
import type { Profile as AuthProfile } from '../types/auth.js';
import type { Comment, SendStatusResponse, ActionResponse } from '../types/social.js';
import type { ErrorResponse } from '../types/apitypes.js';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { MapPin, Calendar, Share2, ArrowLeft, Flame, Map as MapIcon } from 'lucide-react';
import { RecenterButton, ZoomControlButtons } from '../components/MapControls.js';

type NearbyProblem = {
    id: string | number;
    name: string;
    grade: string | null;
    location_name: string | null;
};

function formatDate(iso: string) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function ProblemDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [problem, setProblem] = useState<ProblemDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [userTitles, setUserTitles] = useState<string[]>([]);

    const [isEditing, setIsEditing] = useState(false);
    const [isPickingLocation, setIsPickingLocation] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', grade: '', location_name: '', lat: 0, lng: 0 });
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

    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    const isCreator = !!user && !!problem && user.id === problem.created_by;
    const isCouncil = userTitles.includes('Council');
    const canEdit = isCreator || isCouncil;

    useEffect(() => {
        if (!id) return;
        setIsLoading(true);
        setLoadError(null);

        api.get<ProblemDetail | ErrorResponse>(`/api/problems/${id}`).then(data => {
            if (!('error' in data)) {
                setProblem(data);
                setSendCount(data.send_count || 0);
                setEditForm({
                    name: data.name,
                    grade: data.grade || '',
                    location_name: data.location_name || '',
                    lat: data.latitude ?? 0,
                    lng: data.longitude ?? 0,
                });
            } else {
                setLoadError(data.error || 'This problem could not be found.');
            }
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

    useEffect(() => {
        if (!user?.id) return;
        api.get<AuthProfile | ErrorResponse>(`/api/profiles/${user.id}`).then(data => {
            if (!('error' in data) && data.title) {
                const parsed = typeof data.title === 'string' ? JSON.parse(data.title) : data.title;
                setUserTitles(parsed || []);
            }
        });
    }, [user]);

    useEffect(() => {
        if (!problem?.location_name) return;
        api.get<NearbyProblem[] | ErrorResponse>('/api/problems').then((data) => {
            if (Array.isArray(data)) {
                setNearby(
                    data.filter(p => p.location_name === problem.location_name && String(p.id) !== String(problem.id)).slice(0, 5)
                );
            }
        });
    }, [problem?.location_name, problem?.id]);

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
            const data = await api.put<Partial<ErrorResponse>>(`/api/problems/${id}`, editForm);
            if (data.error) {
                showError(`Error updating: ${data.error}`);
            } else {
                setProblem(prev => prev ? { ...prev, ...editForm, latitude: editForm.lat, longitude: editForm.lng } : prev);
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

    const handleDelete = async () => {
        if (!id || !window.confirm('Are you sure you want to delete this problem?')) return;
        setIsProcessing(true);
        try {
            const res = await api.delete<Partial<ErrorResponse>>(`/api/problems/${id}`);
            if (res.error) {
                showError(`Error deleting: ${res.error}`);
            } else {
                navigate('/directory');
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

    const markerPosition = useMemo<[number, number] | null>(() => {
        if (problem?.latitude == null || problem?.longitude == null) return null;
        return [editForm.lat || problem.latitude, editForm.lng || problem.longitude];
    }, [editForm.lat, editForm.lng, problem?.latitude, problem?.longitude]);

    if (isLoading) return (
        <div className="min-h-screen bg-ink flex items-center justify-center">
            <div className="text-text-muted font-serif tracking-wider">Loading problem...</div>
        </div>
    );

    if (loadError || !problem) return (
        <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="font-serif text-2xl font-black text-text">Problem not found</div>
            <div className="text-sm text-text-dim">{loadError}</div>
            <Link to="/directory" className="mt-2 text-sm text-accent hover:underline">Back to the directory</Link>
        </div>
    );

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

            <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-12">
                <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                    <Link to="/directory" className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors w-fit">
                        <ArrowLeft size={14} className="shrink-0" /> Back to Directory
                    </Link>

                    {/* Hero */}
                    <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                        {problem.image_urls && problem.image_urls.length > 0 && (
                            <HorizontalScrollCarousel itemCount={problem.image_urls.length} outerMarginX={0} paddingX={0}>
                                {problem.image_urls.map((url, i) => (
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
                                        <span className="flex items-center gap-1 text-xs text-text-dim">
                                            <MapPin size={12} className="shrink-0" /> {problem.location_name || 'Location not set'}
                                        </span>
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

                                <button
                                    onClick={() => navigate(`/map?lat=${problem.latitude}&lng=${problem.longitude}`)}
                                    className="ml-auto inline-flex items-center gap-1.5 bg-transparent border border-border hover:border-accent text-text-muted hover:text-accent px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    <MapIcon size={13} className="shrink-0" /> Open in Map
                                </button>
                            </div>

                            {canEdit && !isEditing && (
                                <div className="flex gap-3 pt-1 border-t border-border">
                                    <button onClick={() => setIsEditing(true)} className="flex-1 mt-3 py-2 bg-accent/10 border border-accent/25 text-accent rounded-lg text-xs cursor-pointer hover:bg-accent/15 transition-colors">Edit Details</button>
                                    <button onClick={handleDelete} disabled={isProcessing} className="flex-1 mt-3 py-2 bg-danger/10 border border-danger/40 text-danger rounded-lg text-xs cursor-pointer hover:bg-danger/15 transition-colors disabled:opacity-50">Delete</button>
                                </div>
                            )}

                            {isEditing && (
                                <ProblemEditForm
                                    problemId={problem.id}
                                    initialGrade={problem.grade || ''}
                                    name={editForm.name}
                                    onNameChange={v => setEditForm(prev => ({ ...prev, name: v }))}
                                    locationName={editForm.location_name}
                                    onLocationNameChange={v => setEditForm(prev => ({ ...prev, location_name: v }))}
                                    lat={editForm.lat}
                                    lng={editForm.lng}
                                    onPickLocation={() => setIsPickingLocation(true)}
                                    onGradeChange={grade => setEditForm(prev => ({ ...prev, grade }))}
                                    images={problem.image_urls}
                                    onImagesChange={urls => setProblem(prev => prev ? { ...prev, image_urls: urls } : prev)}
                                    onSave={handleSave}
                                    onCancel={() => { setIsEditing(false); setIsPickingLocation(false); }}
                                    isProcessing={isProcessing}
                                    onError={showError}
                                />
                            )}
                        </div>
                    </div>

                    {/* Mini map */}
                    {markerPosition && (
                        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                            {isPickingLocation && (
                                <div className="px-4 py-2 bg-accent/10 border-b border-accent/25 text-xs text-accent">
                                    Click the map to set the new location
                                </div>
                            )}
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
                                    {isPickingLocation && (
                                        <ClickToPick onPick={(lat, lng) => {
                                            setEditForm(prev => ({ ...prev, lat, lng }));
                                            setIsPickingLocation(false);
                                        }} />
                                    )}
                                </MapContainer>
                            </div>
                        </div>
                    )}

                    {/* Nearby problems */}
                    {nearby.length > 0 && (
                        <div className="bg-panel border border-border rounded-2xl p-5">
                            <div className="text-[11px] text-text-dim tracking-wide uppercase mb-3">Also at {problem.location_name}</div>
                            <div className="flex flex-col gap-2">
                                {nearby.map(p => (
                                    <Link
                                        key={p.id}
                                        to={`/problems/${p.id}`}
                                        className="flex items-center justify-between gap-3 text-sm no-underline px-3 py-2 rounded-lg hover:bg-surface transition-colors"
                                    >
                                        <span className="text-text-secondary truncate">{p.name}</span>
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
                                    const canDeleteComment = user && (user.id === comment.user_id || isCouncil);
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
