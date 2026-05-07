import { useState } from 'react'
import { api } from '../lib/api.js'
import { useMapEvents } from 'react-leaflet'
import type { LeafletMouseEvent } from 'leaflet'

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10']

type NewProblem = {
    name: string
    grade: string
    location: string
    lat: number | null
    lng: number | null
    imageFiles: File[]
    imagePreviews: string[]
}

type Props = {
    onClose: () => void
    onAdded: (problem: any) => void
    newProblem: NewProblem
    setNewProblem: (val: NewProblem) => void
    isPicking: boolean
    setIsPicking: (val: boolean) => void
}

export function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e: LeafletMouseEvent) {
            console.log('map clicked', e.latlng)
            onPick(e.latlng.lat, e.latlng.lng)
        }
    })
    return null
}

export default function AddProblemModal({ onClose, onAdded, newProblem, setNewProblem, isPicking, setIsPicking }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!newProblem.name || newProblem.lat === null || newProblem.lng === null) {
            alert('Please fill in name and pick a location on the map');
            // show toast instead alert
            return;
        }
        setIsSubmitting(true);
        const data = await api.post('/api/problems', newProblem);
        setIsSubmitting(false);
        if (data.error) { alert(data.error); return; }
        onAdded(data)
        onClose();
    }

    const inputStyle = {
        width: '100%', background: '#1a1612',
        border: '1px solid #2a2420', borderRadius: '10px',
        padding: '10px 14px', color: '#d8c8b8',
        fontFamily: "'DM Sans', sans-serif'",
        fontSize: '14px',
        outline: 'none'
    }

    const labelStyle = {
        fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em',
        textTransform: 'uppercase' as const, marginBottom: '6px'
    }

    if (isPicking) {
        return (
            <>
                {/* Mini card */}
                <div style={{
                    position: 'fixed', bottom: '32px', left: '32px',
                    background: 'rgba(20,18,16,0.97)', border: '1px solid #c87a30',
                    borderRadius: '16px', padding: '16px 20px',
                    zIndex: 1000, fontFamily: "'DM Sans', sans-serif",
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                    minWidth: '220px'
                }}>
                    <p style={{ fontSize: '13px', color: '#f0e0c8', fontWeight: 500 }}>
                        📍 Click on the map to set location
                    </p>
                    <button onClick={() => setIsPicking(false)} style={{
                        padding: '7px 14px', background: 'transparent',
                        border: '1px solid #2a2420', borderRadius: '8px',
                        color: '#6a5848', fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px', cursor: 'pointer'
                    }}>Cancel</button>
                </div>
            </>
        )
    }

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px'
        }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{
                background: '#141210', border: '1px solid #2a2420',
                borderRadius: '20px', padding: '32px',
                width: '100%', maxWidth: '440px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
                fontFamily: "'DM Sans', sans-serif"
            }}>
                <h2 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '22px', fontWeight: 900,
                    color: '#f0e0c8', marginBottom: '24px'
                }}>Add Problem</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Name */}
                    <div>
                        <div style={labelStyle}>Problem Name *</div>
                        <input
                            value={newProblem.name}
                            onChange={e => setNewProblem({ ...newProblem, name: e.target.value })}
                            placeholder="e.g. Slab Mantap"
                            style={inputStyle}
                        />
                    </div>

                    {/* Grade */}
                    <div>
                        <div style={labelStyle}>Grade</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {GRADES.map(g => (
                                <button key={g} onClick={() => setNewProblem({ ...newProblem, grade: g })}
                                    style={{
                                        padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                                        fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                                        background: newProblem.grade === g ? 'rgba(200,122,48,0.12)' : 'transparent',
                                        border: newProblem.grade === g ? '1px solid #c87a30' : '1px solid #2a2420',
                                        color: newProblem.grade === g ? '#c87a30' : '#6a5848',
                                        transition: 'all 0.2s'
                                    }}
                                >{g}</button>
                            ))}
                        </div>
                    </div>

                    {/* Location name */}
                    <div>
                        <div style={labelStyle}>Location Name</div>
                        <input
                            value={newProblem.location}
                            onChange={e => setNewProblem({ ...newProblem, location: e.target.value })}
                            placeholder="e.g. Parang, Jawa Barat"
                            style={inputStyle}
                        />
                    </div>

                    {/* Lat Lng picker */}
                    <div>
                        <div style={labelStyle}>Location on Map *</div>
                        {newProblem.lat ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{
                                    flex: 1, padding: '10px 14px',
                                    background: 'rgba(93,187,106,0.1)',
                                    border: '1px solid #5dbb6a',
                                    borderRadius: '10px', color: '#5dbb6a',
                                    fontFamily: "'DM Sans', sans-serif", fontSize: '13px'
                                }}>
                                    📍 {newProblem.lat.toFixed(4)}, {newProblem.lng?.toFixed(4)}
                                </div>
                                <button onClick={() => setIsPicking(true)} style={{
                                    padding: '10px 14px',
                                    background: 'transparent',
                                    border: '1px solid #2a2420',
                                    borderRadius: '10px', cursor: 'pointer',
                                    color: '#8a7060', fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '12px', whiteSpace: 'nowrap',
                                    transition: 'all 0.2s'
                                }}>✏️ Edit</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsPicking(true)} style={{
                                width: '100%', padding: '10px',
                                background: 'transparent',
                                border: '1px solid #2a2420',
                                borderRadius: '10px', cursor: 'pointer',
                                color: '#6a5848',
                                fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                                transition: 'all 0.2s'
                            }}>
                                📍 Click to pick on map
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '11px',
                            background: 'transparent', border: '1px solid #2a2420',
                            borderRadius: '10px', color: '#6a5848',
                            fontFamily: "'DM Sans', sans-serif", fontSize: '14px', cursor: 'pointer'
                        }}>Cancel</button>
                        <button onClick={handleSubmit} disabled={isSubmitting} style={{
                            flex: 2, padding: '11px',
                            background: 'linear-gradient(145deg, #c87a30, #8b4a18)',
                            border: 'none', borderRadius: '10px',
                            color: '#fef3e6', fontFamily: "'DM Sans', sans-serif",
                            fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                            opacity: isSubmitting ? 0.5 : 1,
                            boxShadow: '0 2px 12px rgba(200,122,48,0.3)'
                        }}>{isSubmitting ? 'Submitting...' : 'Add Problem'}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}