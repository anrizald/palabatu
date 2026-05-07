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
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: '#141210', border: '1px solid #2a2420', borderRadius: '20px',
                padding: '24px', width: '90%', maxWidth: '400px',
                fontFamily: "'DM Sans', sans-serif", color: '#f0e0c8'
            }}>
                {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px' }}>Edit Problem</h2>

                        <div>
                            <label style={{ fontSize: '12px', color: '#8a7060', marginBottom: '4px', display: 'block' }}>Name</label>
                            <input
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                style={{ width: '100%', padding: '10px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '8px', color: '#fff' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', color: '#8a7060', marginBottom: '4px', display: 'block' }}>Grade</label>
                            <input
                                value={editForm.grade}
                                onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                                style={{ width: '100%', padding: '10px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '8px', color: '#fff' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #4a3c30', color: '#8a7060', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleSave} disabled={isProcessing} style={{ flex: 1, padding: '10px', background: '#c87a30', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                {isProcessing ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0, color: '#f0e0c8' }}>{problem.name}</h2>
                                <span style={{ background: 'rgba(200,122,48,0.15)', color: '#c87a30', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', display: 'inline-block', marginTop: '8px' }}>
                                    {problem.grade}
                                </span>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a7060', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ margin: '24px 0', color: '#8a7060', fontSize: '14px', lineHeight: '1.6' }}>
                            <p>📍 {problem.location_name}</p>
                            <p>👤 Added by <span style={{ color: '#c87a30' }}>@{problem.creator_name || 'unknown'}</span></p>
                        </div>

                        {canEdit && (
                            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid #2a2420', paddingTop: '20px' }}>
                                <button onClick={() => setIsEditing(true)} style={{ flex: 1, padding: '10px', background: 'rgba(200,122,48,0.1)', border: '1px solid #c87a3040', color: '#c87a30', borderRadius: '8px', cursor: 'pointer' }}>Edit</button>
                                <button onClick={handleDelete} disabled={isProcessing} style={{ flex: 1, padding: '10px', background: 'rgba(220, 53, 69, 0.1)', border: '1px solid rgba(220, 53, 69, 0.4)', color: '#dc3545', borderRadius: '8px', cursor: 'pointer' }}>
                                    {isProcessing ? '...' : 'Delete'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}