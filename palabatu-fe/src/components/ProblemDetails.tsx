import { api } from '../lib/api.js';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext.js';
import Toast, { type ToastProps } from './Toast.js';
import HorizontalScrollCarousel from './HorizontalScrollCarousel.js';
import { GRADE_SCALES, type ProblemType } from '../lib/constants.js';

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

export default function ProblemDetails({ problem, userTitles = [], onClose, onDelete, onUpdate }: ProblemDetailsProps) {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: problem.name,
        grade: problem.grade,
        location_name: problem.location_name
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
    const [toast, setToast] = useState<ToastProps | null>(null);
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) });

    // --- GRADE PICKER STATE ---
    const [problemType, setProblemType] = useState<ProblemType>('boulder');
    const [gradeScale, setGradeScale] = useState<string>('V-Scale');
    const [isRange, setIsRange] = useState(false);
    const [gradeFrom, setGradeFrom] = useState('');
    const [gradeTo, setGradeTo] = useState('');

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>;
    const grades: readonly string[] = currentScales[gradeScale] || [];

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

    // Auto-detect the existing grade when "Edit Details" is clicked
    useEffect(() => {
        if (isEditing && problem.grade) {
            const isRng = problem.grade.includes('-');
            setIsRange(isRng);

            const from = isRng ? problem.grade.split('-')[0] : problem.grade;
            const to = isRng ? problem.grade.split('-')[1] : '';

            // Search all scales to find where this grade belongs
            let foundType: ProblemType = 'boulder';
            let foundScale = 'V-Scale';

            for (const [ptype, scales] of Object.entries(GRADE_SCALES)) {
                // Notice the 'readonly' string[] here!
                for (const [scaleName, gradesArray] of Object.entries(scales as Record<string, readonly string[]>)) {
                    if (gradesArray.includes(from)) {
                        foundType = ptype as ProblemType;
                        foundScale = scaleName;
                    }
                }
            }

            setProblemType(foundType);
            setGradeScale(foundScale);
            setGradeFrom(from);
            setGradeTo(to);
        }
    }, [isEditing, problem.grade]);

    // Sync the picker to the edit form
    useEffect(() => {
        if (!gradeFrom) return;
        const gradeStr = isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom;
        setEditForm(prev => ({ ...prev, grade: gradeStr }));
    }, [gradeFrom, gradeTo, isRange]);

    const handleGradePick = (g: string) => {
        if (!isRange) {
            setGradeFrom(g);
            setGradeTo('');
            return;
        }
        if (!gradeFrom || (gradeFrom && gradeTo)) {
            setGradeFrom(g);
            setGradeTo('');
        } else {
            const fromIdx = grades.indexOf(gradeFrom);
            const toIdx = grades.indexOf(g);
            if (toIdx > fromIdx) setGradeTo(g);
            else { setGradeFrom(g); setGradeTo(''); }
        }
    };

    const segmentBtn = (active: boolean) => ({
        flex: 1, padding: '7px 0', fontSize: '12px', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        background: active ? 'rgba(200,122,48,0.15)' : 'transparent',
        border: 'none', color: active ? '#c87a30' : '#6a5848',
        fontWeight: active ? 700 : 400, transition: 'all 0.2s', borderRadius: '8px'
    });

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
                onUpdate({ ...problem, ...editForm });
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

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 13, 11, 0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: '20px 0 0 0'
        }}>
            {toast && <Toast {...toast} />}
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
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#8a7060', fontSize: '24px', cursor: 'pointer',
                        lineHeight: 1
                    }}>&times;</button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px' }}>

                    {problem.image_urls && problem.image_urls.length > 0 && (
                        <div style={{ margin: '20px 0' }}>
                            <HorizontalScrollCarousel itemCount={problem.image_urls.length}>
                                {problem.image_urls.map((url: string, i: number) => (
                                    <img key={i} src={url} alt="Topo" style={{
                                        height: '300px', width: '80vw', maxWidth: '400px', objectFit: 'cover',
                                        borderRadius: '16px', scrollSnapAlign: 'center', flexShrink: 0
                                    }} />
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
                        Added by <Link to={`/profile/${problem.created_by}`} style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 'bold' }}>@{problem.creator_name || 'unknown'}</Link>
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
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                            {/* Name */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Problem Name</div>
                                <input
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Slab Mantap"
                                    style={{ width: '100%', background: '#1a1612', border: '1px solid #2a2420', padding: '10px 12px', borderRadius: '10px', color: '#d8c8b8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Grade */}
                            {/* Grade */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Grade</div>

                                {/* Problem Type toggle */}
                                <div style={{ display: 'flex', gap: '4px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                                    {(['boulder', 'rope'] as ProblemType[]).map(t => (
                                        <button key={t} onClick={() => { setProblemType(t); setGradeFrom(''); setGradeTo(''); }} style={segmentBtn(problemType === t)}>
                                            {t === 'boulder' ? '🪨 Boulder' : '🧗 Rope'}
                                        </button>
                                    ))}
                                </div>

                                {/* Scale toggle */}
                                <div style={{ display: 'flex', gap: '4px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                                    {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                                        <button key={scale} onClick={() => { setGradeScale(scale); setGradeFrom(''); setGradeTo(''); }} style={segmentBtn(gradeScale === scale)}>
                                            {scale}
                                        </button>
                                    ))}
                                </div>

                                {/* Range toggle & Selected Text */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontSize: '12px', color: '#6a5848' }}>
                                        {isRange
                                            ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                                            : editForm.grade ? `Selected: ${editForm.grade}` : 'Pick a grade'}
                                    </span>
                                    <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo(''); }}
                                        style={{
                                            fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                            background: isRange ? 'rgba(200,122,48,0.15)' : 'transparent',
                                            border: `1px solid ${isRange ? '#c87a30' : '#2a2420'}`,
                                            color: isRange ? '#c87a30' : '#6a5848', transition: 'all 0.2s'
                                        }}>
                                        ⇔ Range
                                    </button>
                                </div>

                                {/* Grade pills */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {grades.map(g => {
                                        const isFrom = g === gradeFrom;
                                        const isTo = g === gradeTo;
                                        const inRange = isRange && gradeFrom && gradeTo
                                            ? grades.indexOf(g) > grades.indexOf(gradeFrom) && grades.indexOf(g) < grades.indexOf(gradeTo)
                                            : false;
                                        const active = isFrom || isTo || inRange;

                                        return (
                                            <button key={g} onClick={() => handleGradePick(g)} style={{
                                                padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                                                fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                                                background: isFrom || isTo ? 'rgba(200,122,48,0.2)' : inRange ? 'rgba(200,122,48,0.08)' : 'transparent',
                                                border: active ? '1px solid #c87a30' : '1px solid #2a2420',
                                                color: active ? '#c87a30' : '#6a5848', transition: 'all 0.15s'
                                            }}>{g}</button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Location */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Location Name</div>
                                <input
                                    value={editForm.location_name}
                                    onChange={e => setEditForm(prev => ({ ...prev, location_name: e.target.value }))}
                                    placeholder="e.g. Parang, Jawa Barat"
                                    style={{ width: '100%', background: '#1a1612', border: '1px solid #2a2420', padding: '10px 12px', borderRadius: '10px', color: '#d8c8b8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* Pinpoint */}
                            <div>
                                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Location on Map</div>
                                <div style={{ padding: '10px 14px', background: 'rgba(93,187,106,0.1)', border: '1px solid #5dbb6a', borderRadius: '10px', color: '#5dbb6a', fontSize: '13px' }}>
                                    📍 {problem.lat?.toFixed(4)}, {problem.lng?.toFixed(4)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6a5848', fontStyle: 'italic', marginTop: '4px' }}>Pinpoint editing coming soon</div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleSave} disabled={isProcessing} style={{ flex: 1, padding: '8px', background: 'rgba(200,122,48,0.1)', border: '1px solid #c87a3040', color: '#c87a30', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                    {isProcessing ? 'Saving...' : 'Save'}
                                </button>
                                <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2420', color: '#8a7060', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
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
                                comments.map(comment => (
                                    <div key={comment.id} style={{ fontSize: '13px', color: '#d8c8b8', background: 'rgba(20,18,16,0.5)', padding: '12px', borderRadius: '12px', border: '1px solid #2a2420' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <Link to={`/profile/${comment.user_id}`} style={{ color: '#c87a30', textDecoration: 'none', fontWeight: 'bold' }}>
                                                @{comment.username}
                                            </Link>
                                            <span style={{ color: '#6a5848', fontSize: '11px' }}>
                                                {new Date(comment.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div style={{ lineHeight: '1.4' }}>{comment.content}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}