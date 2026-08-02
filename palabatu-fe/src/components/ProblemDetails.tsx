import { api } from '../lib/api.js';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/useAuth.js';
import Toast, { type ToastProps } from './Toast.js';
import HorizontalScrollCarousel from './HorizontalScrollCarousel.js';
import ProblemEditForm from './ProblemEditForm.js';
import ReportModal, { type ReportTarget } from './ReportModal.js';
import TopoImage from './topo-annotations/TopoImage.js';
import type { AnnotationRecord, Shape } from '../types/annotation.js';
import type { ProblemRow } from '../types/problem.js';
import type { Comment, SendStatusResponse, ActionResponse } from '../types/social.js';
import type { ErrorResponse } from '../types/apitypes.js';
import { MapPin, Flame } from 'lucide-react';

type ProblemDetailsProps = {
    problem: ProblemRow;
    userTitles?: string[],
    onClose: () => void;
    onDelete: (id: string | number) => void;
    onUpdate: (updatedProblem: ProblemRow) => void;
    isPicking?: boolean;
    setIsPicking?: (val: boolean) => void;
    pickedCoords?: { lat: number; lng: number } | null;
};

export default function ProblemDetails({ problem, userTitles = [], onClose, onDelete, onUpdate, isPicking = false, setIsPicking, pickedCoords }: ProblemDetailsProps) {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: problem.name,
        grade: problem.grade,
        location_name: problem.location_name,
        lat: problem.latitude,
        lng: problem.longitude
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const isCreator = user && user.id === problem.created_by;
    const isCouncil = userTitles.includes('Council');
    const canEdit = isCreator || isCouncil;

    const [sendCount, setSendCount] = useState(problem.send_count || 0);
    const [hasSent, setHasSent] = useState(false); // This would ideally come from the backend to check if the user has already logged a send for this problem
    const [isTogglingSend, setIsTogglingSend] = useState(false);

    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [annotationsByUrl, setAnnotationsByUrl] = useState<Record<string, Shape[]>>({});
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await api.get<Comment[] | ErrorResponse>(`/api/problems/${problem.id}/comments`);
                if (Array.isArray(res)) setComments(res);
            } catch (e) {
                console.error('Failed to fetch comments', e);
            }
        };

        fetchComments();

        if (user) {
            const checkStatus = async () => {
                try {
                    const res = await api.get<SendStatusResponse | ErrorResponse>(`/api/problems/${problem.id}/send-status`);
                    setHasSent('hasSent' in res && res.hasSent);
                } catch (e) {
                    console.error('Failed to check send status', e);
                    setHasSent(false);
                }
            }; checkStatus();
        }
    }, [problem.id, user]);

    // Sync a freshly-picked map location into the edit form
    useEffect(() => {
        if (!pickedCoords) return;
        setEditForm(prev => ({ ...prev, lat: pickedCoords.lat, lng: pickedCoords.lng }));
    }, [pickedCoords]);

    useEffect(() => {
        api.get<AnnotationRecord[] | ErrorResponse>(`/api/problems/${problem.id}/annotations`).then(rows => {
            if (Array.isArray(rows)) {
                setAnnotationsByUrl(Object.fromEntries(rows.map(r => [r.image_url, r.data])));
            }
        }).catch((e: unknown) => console.error('Failed to fetch annotations', e));
    }, [problem.id]);

    const handleToggleSend = async () => {
        setIsTogglingSend(true);
        try {
            const res = await api.post<ActionResponse | ErrorResponse>(`api/problems/${problem.id}/send`, {});
            if ('action' in res && res.action === 'added') {
                setHasSent(true);
                setSendCount((prev: number) => prev + 1);
            } else if ('action' in res && res.action === 'removed') {
                setHasSent(false);
                setSendCount((prev: number) => prev - 1);
            }
        } catch (e) {
            console.error('Failed to toggle send', e);
            showError('Failed to log send. Check your connection.');
        } finally {
            setIsTogglingSend(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this problem?')) return;
        setIsProcessing(true);

        try {
            const res = await api.delete<Partial<ErrorResponse>>(`/api/problems/${problem.id}`);

            if (res.error) {
                showError(`Error deleting: ${res.error}`);
            } else {
                onDelete(problem.id);
                onClose();
            }
        } catch (e) {
            console.error('Delete failed', e);
            showError('Failed to delete problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const data = await api.put<Partial<ErrorResponse>>(`/api/problems/${problem.id}`, editForm);

            if (data.error) {
                showError(`Error updating: ${data.error}`);
            } else {
                onUpdate({ ...problem, ...editForm, latitude: editForm.lat, longitude: editForm.lng });
                setIsEditing(false);
            }
        }
        catch (e) {
            console.error('Update failed', e);
            showError('Failed to update problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        setIsPostingComment(true);

        try {
            const data = await api.post<Comment | ErrorResponse>(`/api/problems/${problem.id}/comments`, { content: newComment });
            if ('error' in data) {
                showError(data.error);
            } else {
                // Instantly add the new comment to the list so it updates on screen!
                setComments(prev => [...prev, data]);
                setNewComment(''); // Clear the input box
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
        if (!reportTarget) return;
        setIsSubmittingReport(true);

        try {
            const res = reportTarget.type === 'comment'
                ? await api.post<Partial<ErrorResponse>>(`/api/comments/${reportTarget.id}/report`, { reason })
                : await api.post<Partial<ErrorResponse>>(`/api/problems/${problem.id}/images/report`, { url: reportTarget.url, reason });

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

    if (isPicking) {
        return (
            <div className="fixed bottom-8 left-8 bg-panel/[0.97] border border-accent rounded-2xl px-5 py-4 z-[10000] font-sans shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-2.5 min-w-[220px]">
                <p className="text-[13px] text-text font-medium flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0" /> Click on the map to set the new location
                </p>
                <button onClick={() => setIsPicking?.(false)} className="px-3.5 py-[7px] bg-transparent border border-border rounded-lg text-text-dim text-xs cursor-pointer">Cancel</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-ink/85 backdrop-blur-sm flex items-center justify-center z-[9999] pt-5">
            {toast && <Toast {...toast} />}
            {reportTarget && (
                <ReportModal
                    target={reportTarget}
                    onClose={() => setReportTarget(null)}
                    onSubmit={submitReport}
                    isSubmitting={isSubmittingReport}
                />
            )}
            <div className="bg-panel border border-border rounded-3xl w-full max-w-[500px] max-h-[90vh] h-auto flex flex-col font-sans text-text overflow-hidden">
                <div className="px-5 py-2 flex justify-between items-center border-b border-border">
                    <h2 className="font-serif text-2xl m-0">{problem.name}</h2>
                    <div className="flex items-center gap-3.5">
                        <Link to={`/problems/${problem.id}`} className="text-accent text-[11px] font-bold no-underline">
                            Full page &#8599;
                        </Link>
                        <button onClick={onClose} className="bg-transparent border-0 text-text-muted text-2xl cursor-pointer leading-none">&times;</button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 px-5 pb-5">

                    {problem.image_urls && problem.image_urls.length > 0 && (
                        <div className="my-5">
                            <HorizontalScrollCarousel itemCount={problem.image_urls.length}>
                                {problem.image_urls.map((url: string, i: number) => (
                                    <div key={i} className="shrink-0" style={{ scrollSnapAlign: 'center' }}>
                                        <TopoImage
                                            problemId={String(problem.id)}
                                            url={url}
                                            shapes={annotationsByUrl[url] ?? []}
                                            canEdit={!!canEdit}
                                            canReport={!!user}
                                            onReport={() => setReportTarget({ type: 'image', url })}
                                            onSaved={(shapes) => setAnnotationsByUrl(prev => ({ ...prev, [url]: shapes }))}
                                            className="h-[300px] w-[80vw] max-w-[400px] rounded-2xl"
                                        />
                                    </div>
                                ))}
                            </HorizontalScrollCarousel>
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-5">
                        <div>
                            <span className="bg-accent/15 text-accent px-3.5 py-1.5 rounded-full text-sm font-bold mr-2.5">
                                {problem.grade}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[13px] text-text-muted">
                                <MapPin size={12} className="shrink-0" /> {problem.location_name}
                            </span>
                        </div>

                        <button
                            onClick={handleToggleSend}
                            disabled={isTogglingSend}
                            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold transition-colors ${hasSent ? 'bg-associate/15 border border-associate text-associate' : 'bg-accent text-on-accent border border-transparent'} ${isTogglingSend ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <Flame size={14} className="shrink-0" /> {hasSent ? 'Sent!' : 'Log Send'}
                        </button>
                    </div>
                    <div className="mt-3 text-xs text-text-dim flex items-center gap-1">
                        Added by <Link to={`/profile/${problem.creator_slug}`} className="text-accent no-underline font-bold">{problem.creator_name || 'unknown'}</Link>
                        <span>• <Flame size={11} className="inline shrink-0" /> {sendCount} {sendCount === 1 ? 'Send' : 'Sends'}</span>
                    </div>

                    {/* Edit/Delete if Owner */}
                    {canEdit && (
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setIsEditing(true)} className="flex-1 p-2 bg-accent/10 border border-accent/25 text-accent rounded-lg cursor-pointer text-xs">Edit Details</button>
                            <button onClick={handleDelete} disabled={isProcessing} className="flex-1 p-2 bg-danger/10 border border-danger/40 text-danger rounded-lg cursor-pointer text-xs">Delete</button>
                        </div>
                    )}

                    {/* Edit Form */}
                    {isEditing && (
                        <ProblemEditForm
                            initialGrade={problem.grade || ''}
                            name={editForm.name}
                            onNameChange={v => setEditForm(prev => ({ ...prev, name: v }))}
                            locationName={editForm.location_name}
                            onLocationNameChange={v => setEditForm(prev => ({ ...prev, location_name: v }))}
                            lat={editForm.lat}
                            lng={editForm.lng}
                            onPickLocation={() => setIsPicking?.(true)}
                            onGradeChange={grade => setEditForm(prev => ({ ...prev, grade }))}
                            onSave={handleSave}
                            onCancel={() => setIsEditing(false)}
                            isProcessing={isProcessing}
                        />
                    )}

                    {/* Comments / Beta Section */}
                    {!isEditing && (
                    <div className="mt-8 border-t border-border pt-6">
                        <h3 className="font-serif text-lg text-text mb-4">Beta & Comments</h3>

                        {/* Input Area */}
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
                                    className="bg-surface text-accent px-4 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                    {isPostingComment ? '...' : 'Post'}
                                </button>
                            </div>
                        ) : (
                            <div className="text-sm text-text-dim italic mb-5">Log in to comment!</div>
                        )}

                        {/* Comments */}
                        <div className="flex flex-col gap-4">
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
                                                    <span className="text-text-dim text-[11px]">
                                                        {new Date(comment.created_at).toLocaleDateString()}
                                                    </span>
                                                    {user && user.id !== comment.user_id && (
                                                        <button
                                                            onClick={() => setReportTarget({ type: 'comment', id: comment.id, content: comment.content })}
                                                            className="bg-transparent border-0 text-text-muted text-[11px] cursor-pointer p-0">
                                                            Report
                                                        </button>
                                                    )}
                                                    {canDeleteComment && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            disabled={deletingCommentId === comment.id}
                                                            className="bg-transparent border-0 text-danger text-[11px] cursor-pointer p-0 disabled:opacity-50">
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
        </div>
    )
}
