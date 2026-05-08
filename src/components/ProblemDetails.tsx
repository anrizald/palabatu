import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.js';
import HorizontalScrollCarousel from './HorizontalScrollCarousel.js';

type ProblemDetailsProps = {
    problem: any;
    userTitles?: string[],
    onClose: () => void;
    onDelete: (id: string | number) => void;
    onUpdate: (updatedProblem: any) => void;
};

export default function ProblemDetails({ problem, userTitles = [], onClose, onDelete, onUpdate }: ProblemDetailsProps) {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: problem.name, grade: problem.grade });
    const [isProcessing, setIsProcessing] = useState(false);

    const isCreator = user && user.id === problem.created_by;
    const isCouncil = userTitles.includes('Council');
    const canEdit = isCreator || isCouncil;

    const [sendCount, setSendCount] = useState(problem.send_count || 0);
    const [hasSent, setHasSent] = useState(false); // This would ideally come from the backend to check if the user has already logged a send for this problem
    const [isTogglingSend, setIsTogglingSend] = useState(false);

    useEffect(() => {
        if (user) {
            const checkStatus = async () => {
                try {
                    const res = await api.get(`/api/problems/${problem.id}/send-status`);
                    setHasSent(res.hasSent);
                } catch (e) {
                    console.error('Failed to check send status', e);
                }
            };
            checkStatus();
        }
    }, [problem.id]);

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
            // to do : change to Toast()
            alert('Failed to log send. Check your connection.');
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
                // to do : change to Toast()
                alert(`Error deleting: ${res.error}`);
            } else {
                onDelete(problem.id);
                onClose();
            }
        } catch (e) {
            console.error('Delete failed', e);
            // to do : change to Toast()
            alert('Failed to delete problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        setIsProcessing(true);
        try {
            const data = await api.put(`/api/problems/${problem.id}`, editForm);

            if (data.error) {
                // to do : change to Toast()
                alert(`Error updating: ${data.error}`);
            } else {
                onUpdate({ ...problem, ...editForm });
                setIsEditing(false);
            }
        }
        catch (e) {
            console.error('Update failed', e);
            // to do : change to Toast()
            alert('Failed to update problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 13, 11, 0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
            padding: '20px 0 0 0'
        }}>
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
                        // padding: 0,      // ← kills the browser default
                        lineHeight: 1   // ← prevents extra height from line-height
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
                        Added by <span style={{ color: '#c87a30' }}>@{problem.creator_name || 'unknown'}</span>
                        {' '}•🔥 {sendCount} {sendCount === 1 ? 'Send' : 'Sends'}
                    </div>

                    {/* Edit/Delete if Owner */}
                    {canEdit && (
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button onClick={() => setIsEditing(true)} style={{ flex: 1, padding: '8px', background: 'rgba(200,122,48,0.1)', border: '1px solid #c87a3040', color: '#c87a30', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Edit Details</button>
                            <button onClick={handleDelete} disabled={isProcessing} style={{ flex: 1, padding: '8px', background: 'rgba(220, 53, 69, 0.1)', border: '1px solid rgba(220, 53, 69, 0.4)', color: '#dc3545', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                        </div>
                    )}

                    {/* 4. Comments / Beta Section (Placeholder UI) */}
                    <div style={{ marginTop: '32px', borderTop: '1px solid #2a2420', paddingTop: '24px' }}>
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#f0e0c8', marginBottom: '16px' }}>Beta & Comments</h3>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <input placeholder="Share your beta..." style={{ flex: 1, background: '#1a1612', border: '1px solid #2a2420', padding: '12px', borderRadius: '12px', color: '#fff', outline: 'none' }} />
                            <button style={{ background: '#2a2420', color: '#c87a30', border: 'none', padding: '0 16px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Post</button>
                        </div>

                        {/* Dummy Comments */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@send_it_steve</strong>
                                Start on the obvious undercling. Crux is throwing to the sloppy right hand. Needs good friction!
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                            <div style={{ fontSize: '13px', color: '#d8c8b8' }}>
                                <strong style={{ color: '#c87a30', display: 'block', marginBottom: '4px' }}>@crimp_master</strong>
                                Landing is a bit sketchy right now, bring two pads.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}