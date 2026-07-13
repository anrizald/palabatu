import { api } from '../lib/api.js';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext.js';
import Toast, { type ToastProps } from './Toast.js';
import HorizontalScrollCarousel from './HorizontalScrollCarousel.js';
import ProblemEditForm from './ProblemEditForm.js';
import ReportModal, { type ReportTarget } from './ReportModal.js';

type ProblemDetailsProps = {
    problem: any;
    userTitles?: string[],
    onClose: () => void;
    onDelete: (id: string | number) => void;
    onUpdate: (updatedProblem: any) => void;
    isPicking?: boolean;
    setIsPicking?: (val: boolean) => void;
    pickedCoords?: { lat: number; lng: number } | null;
};

type Comment = {
    id: string;
    content: string;
    username: string;
    created_at: string;
    user_id: string;
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
    const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });
    const showOk = (message: string) => setToast({ message, type: 'success', onClose: () => setToast(null) });

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await api.get(`/api/problems/${problem.id}/comments`);
                if (!res.error) setComments(res);
            } catch (e) {
                console.error('Failed to fetch comments', e);
            }
        };

        fetchComments();

        if (user) {
            const checkStatus = async () => {
                try {
                    const res = await api.get(`/api/problems/${problem.id}/send-status`);
                    setHasSent(res.hasSent);
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

    const handleToggleSend = async () => {
        setIsTogglingSend(true);
        try {
            const res = await api.post(`api/problems/${problem.id}/send`, {});
            if (res.action === 'added') {
                setHasSent(true);
                setSendCount((prev: number) => prev + 1);
            } else if (res.action === 'removed') {
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
            const res = await api.delete(`/api/problems/${problem.id}`);

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
            const data = await api.put(`/api/problems/${problem.id}`, editForm);

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
            const data = await api.post(`/api/problems/${problem.id}/comments`, { content: newComment });
            if (data.error) {
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
            const res = await api.delete(`/api/comments/${commentId}`);
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
                ? await api.post(`/api/comments/${reportTarget.id}/report`, { reason })
                : await api.post(`/api/problems/${problem.id}/images/report`, { url: reportTarget.url, reason });

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
            <div style={{
                position: 'fixed', bottom: '32px', left: '32px',
                background: 'rgba(20,18,16,0.97)', border: '1px solid #c87a30',
                borderRadius: '16px', padding: '16px 20px',
                zIndex: 10000, fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', gap: '10px',
                minWidth: '220px'
            }}>
                <p style={{ fontSize: '13px', color: '#f0e0c8', fontWeight: 500 }}>
                    📍 Click on the map to set the new location
                </p>
                <button onClick={() => setIsPicking?.(false)} style={{
                    padding: '7px 14px', background: 'transparent',
                    border: '1px solid #2a2420', borderRadius: '8px',
                    color: '#6a5848', fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px', cursor: 'pointer'
                }}>Cancel</button>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 13, 11, 0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: '20px 0 0 0'
        }}>
            {toast && <Toast {...toast} />}
            {reportTarget && (
                <ReportModal
                    target={reportTarget}
                    onClose={() => setReportTarget(null)}
                    onSubmit={submitReport}
                    isSubmitting={isSubmittingReport}
                />
            )}
            <div style={{
                background: '#141210', borderTop: '1px solid #2a2420',
                borderRadius: '24px',
                border: '1px solid #2a2420',
                borderLeft: '1px solid #2a2420', borderRight: '1px solid #2a2420',
                width: '100%', maxWidth: '500px', maxHeight: '90vh', height: 'auto',
                display: 'flex', flexDirection: 'column',
                fontFamily: "'DM Sans', sans-serif", color: '#f0e0c8', overflow: 'hidden'
            }}>
                <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a2420' }}>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', margin: 0 }}>{problem.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Link to={`/problems/${problem.id}`} style={{ color: '#c87a30', fontSize: '11px', fontWeight: 'bold', textDecoration: 'none' }}>
                            Full page ↗
                        </Link>
                        <button onClick={onClose} style={{
                            background: 'none', border: 'none', color: '#8a7060', fontSize: '24px', cursor: 'pointer',
                            lineHeight: 1
                        }}>&times;</button>
                    </div>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px' }}>

                    {problem.image_urls && problem.image_urls.length > 0 && (
                        <div style={{ margin: '20px 0' }}>
                            <HorizontalScrollCarousel itemCount={problem.image_urls.length}>
                                {problem.image_urls.map((url: string, i: number) => (
                                    <div key={i} style={{ position: 'relative', scrollSnapAlign: 'center', flexShrink: 0 }}>
                                        <img src={url} alt="Topo" style={{
                                            height: '300px', width: '80vw', maxWidth: '400px', objectFit: 'cover',
                                            borderRadius: '16px', display: 'block'
                                        }} />
                                        {user && (
                                            <button
                                                onClick={() => setReportTarget({ type: 'image', url })}
                                                title="Report image"
                                                style={{
                                                    position: 'absolute', top: '8px', right: '8px',
                                                    background: 'rgba(20,18,16,0.75)', backdropFilter: 'blur(6px)',
                                                    border: '1px solid #2a2420', color: '#f0e0c8',
                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                    cursor: 'pointer', fontSize: '13px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                ⚑
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </HorizontalScrollCarousel>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                        <div>
                            <span style={{ background: 'rgba(200,122,48,0.15)', color: '#c87a30', padding: '6px 14px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', marginRight: '10px' }}>
                                {problem.grade}
                            </span>
                            <span style={{ fontSize: '13px', color: '#8a7060' }}>📍 {problem.location_name}</span>
                        </div>

                        <button
                            onClick={handleToggleSend}
                            disabled={isTogglingSend}
                            style={{
                                background: hasSent ? 'rgba(93,187,106,0.15)' : '#c87a30',
                                color: hasSent ? '#5dbb6a' : '#fff',
                                border: hasSent ? '1px solid #5dbb6a' : 'none',
                                padding: '10px 16px',
                                borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                transition: 'all 0.2s',
                                opacity: isTogglingSend ? 0.6 : 1
                            }}>
                            {hasSent ? '✅ Sent!' : 'Log Send'}
                        </button>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#6a5848' }}>
                        Added by <Link to={`/profile/${problem.created_by}`} style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 'bold' }}>{problem.creator_name || 'unknown'}</Link>
                        {' '}•🔥 {sendCount} {sendCount === 1 ? 'Send' : 'Sends'}
                    </div>

                    {/* Edit/Delete if Owner */}
                    {canEdit && (
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button onClick={() => setIsEditing(true)} style={{ flex: 1, padding: '8px', background: 'rgba(200,122,48,0.1)', border: '1px solid #c87a3040', color: '#c87a30', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Edit Details</button>
                            <button onClick={handleDelete} disabled={isProcessing} style={{ flex: 1, padding: '8px', background: 'rgba(220, 53, 69, 0.1)', border: '1px solid rgba(220, 53, 69, 0.4)', color: '#dc3545', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
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

                    {/* 4. Comments / Beta Section (Placeholder UI) */}
                    <div style={{ marginTop: '32px', borderTop: '1px solid #2a2420', paddingTop: '24px' }}>
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#f0e0c8', marginBottom: '16px' }}>Beta & Comments</h3>

                        {/* Input Area */}
                        {user ? (
                            < div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <input
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                    placeholder="Share your beta..."
                                    style={{ flex: 1, background: '#1a1612', border: '1px solid #2a2420', padding: '12px', borderRadius: '12px', color: '#fff', outline: 'none' }}
                                />
                                <button
                                    onClick={handlePostComment}
                                    disabled={isPostingComment || !newComment.trim()}
                                    style={{
                                        background: '#2a2420', color: '#c87a30', border: 'none',
                                        padding: '0 16px', borderRadius: '12px', fontWeight: 'bold',
                                        cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                                        opacity: isPostingComment || !newComment.trim() ? 0.5 : 1
                                    }}>
                                    {isPostingComment ? '...' : 'Post'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ fontSize: '13px', color: '#6a5848', fontStyle: 'italic' }}>Log in to comment!</div>
                        )}

                        {/* Comments */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {comments.length === 0 ? (
                                <div style={{ fontSize: '13px', color: '#6a5848', fontStyle: 'italic' }}>No beta yet. Be the first!</div>
                            ) : (
                                comments.map(comment => {
                                    const canDeleteComment = user && (user.id === comment.user_id || isCouncil);
                                    return (
                                        <div key={comment.id} style={{ fontSize: '13px', color: '#d8c8b8', background: 'rgba(20,18,16,0.5)', padding: '12px', borderRadius: '12px', border: '1px solid #2a2420' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <Link to={`/profile/${comment.user_id}`} style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 'bold' }}>
                                                    {comment.username}
                                                </Link>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: '#6a5848', fontSize: '11px' }}>
                                                        {new Date(comment.created_at).toLocaleDateString()}
                                                    </span>
                                                    {user && user.id !== comment.user_id && (
                                                        <button
                                                            onClick={() => setReportTarget({ type: 'comment', id: comment.id, content: comment.content })}
                                                            style={{
                                                                background: 'none', border: 'none', color: '#8a7060',
                                                                fontSize: '11px', cursor: 'pointer', padding: 0
                                                            }}>
                                                            Report
                                                        </button>
                                                    )}
                                                    {canDeleteComment && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            disabled={deletingCommentId === comment.id}
                                                            style={{
                                                                background: 'none', border: 'none', color: '#dc3545',
                                                                fontSize: '11px', cursor: 'pointer', padding: 0,
                                                                opacity: deletingCommentId === comment.id ? 0.5 : 1
                                                            }}>
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ lineHeight: '1.4' }}>{comment.content}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}