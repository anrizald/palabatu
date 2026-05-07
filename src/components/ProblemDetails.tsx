import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.js';

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

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this problem?')) return;
        setIsProcessing(true);

        try {
            const res = await api.delete(`/api/problems/${problem.id}`);

            if (res.error) {
                alert(`Error deleting: ${res.error}`);
            } else {
                onDelete(problem.id);
                onClose();
            }
        } catch (e) {
            console.error('Delete failed', e);
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
                alert(`Error updating: ${data.error}`);
            } else {
                onUpdate({ ...problem, ...editForm });
                setIsEditing(false);
            }
        }
        catch (e) {
            console.error('Update failed', e);
            alert('Failed to update problem. Check your connection.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 13, 11, 0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999,
            padding: '20px 0 0 0' // Bottom sheet style for mobile
        }}>
            <div style={{
                background: '#141210', borderTop: '1px solid #2a2420',
                borderLeft: '1px solid #2a2420', borderRight: '1px solid #2a2420',
                borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '500px', height: '90vh',
                display: 'flex', flexDirection: 'column',
                fontFamily: "'DM Sans', sans-serif", color: '#f0e0c8', overflow: 'hidden'
            }}>
                {/* 1. Header (Sticky) */}
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a2420' }}>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', margin: 0 }}>{problem.name}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a7060', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                </div>

                {/* Scrollable Content Area */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px' }}>

                    {/* 2. Image Gallery (Horizontal Scroll) */}
                    {problem.image_urls && problem.image_urls.length > 0 && (
                        <div style={{
                            display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
                            gap: '12px', margin: '20px -20px', padding: '0 20px',
                            scrollbarWidth: 'none' // Hides scrollbar on Firefox
                        }}>
                            {problem.image_urls.map((url: string, i: number) => (
                                <img key={i} src={url} alt="Topo" style={{
                                    height: '300px', width: '85%', objectFit: 'cover',
                                    borderRadius: '16px', scrollSnapAlign: 'center', flexShrink: 0
                                }} />
                            ))}
                        </div>
                    )}

                    {/* 3. Info & Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                        <div>
                            <span style={{ background: 'rgba(200,122,48,0.15)', color: '#c87a30', padding: '6px 14px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', marginRight: '10px' }}>
                                {problem.grade}
                            </span>
                            <span style={{ fontSize: '13px', color: '#8a7060' }}>📍 {problem.location_name}</span>
                        </div>

                        {/* Placeholder Send Button */}
                        <button style={{
                            background: '#c87a30', color: '#fff', border: 'none', padding: '10px 16px',
                            borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                            ✅ Log Send
                        </button>
                    </div>

                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#6a5848' }}>
                        Added by <span style={{ color: '#c87a30' }}>@{problem.creator_name || 'unknown'}</span> • 🔥 12 Sends
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
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}