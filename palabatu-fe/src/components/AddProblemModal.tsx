import { api } from '../lib/api.js'
import { useState, useEffect } from 'react'
import { useMapEvents } from 'react-leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import type { NewProblem } from '../types/problem.js'
import HorizontalScrollCarousel from './HorizontalScrollCarousel.js'
import { GRADE_SCALES, type ProblemType } from '../lib/constants.js'

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
            onPick(e.latlng.lat, e.latlng.lng)
        }
    })
    return null
}

export default function AddProblemModal({ onClose, onAdded, newProblem, setNewProblem, isPicking, setIsPicking }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Grade state
    const [problemType, setProblemType] = useState<ProblemType>('boulder')
    const [gradeScale, setGradeScale] = useState<string>('V-Scale')
    const [isRange, setIsRange] = useState(false)
    const [gradeFrom, setGradeFrom] = useState('')
    const [gradeTo, setGradeTo] = useState('')

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>;
    const grades: readonly string[] = currentScales[gradeScale] || [];

    // Reset scale when type changes
    useEffect(() => {
        const defaultScale = problemType === 'boulder' ? 'V-Scale' : 'YDS'
        setGradeScale(defaultScale)
        setGradeFrom('')
        setGradeTo('')
        setNewProblem({ ...newProblem, grade: '' })
    }, [problemType])

    // Reset grades when scale changes
    useEffect(() => {
        setGradeFrom('')
        setGradeTo('')
        setNewProblem({ ...newProblem, grade: '' })
    }, [gradeScale])

    // Sync grade string to newProblem
    useEffect(() => {
        if (!gradeFrom) return
        const gradeStr = isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom
        setNewProblem({ ...newProblem, grade: gradeStr })
    }, [gradeFrom, gradeTo, isRange])

    const handleGradePick = (g: string) => {
        if (!isRange) {
            setGradeFrom(g)
            setGradeTo('')
            return
        }
        // Range: pick from first, then to
        if (!gradeFrom || (gradeFrom && gradeTo)) {
            setGradeFrom(g)
            setGradeTo('')
        } else {
            // Enforce order: from must be lower index than to
            const fromIdx = grades.indexOf(gradeFrom)
            const toIdx = grades.indexOf(g)
            if (toIdx > fromIdx) setGradeTo(g)
            else { setGradeFrom(g); setGradeTo('') } // restart if picked lower
        }
    }

    const handleSubmit = async () => {
        if (!newProblem.name || newProblem.lat === null || newProblem.lng === null) {
            // show toast instead alert
            alert('Please fill in name and pick a location on the map');
            return;
        }
        setIsSubmitting(true);

        let uploadedUrls: string[] = [];
        if (newProblem.imageFiles.length > 0) {
            const uploadPromises = newProblem.imageFiles.map(file => {
                const formData = new FormData();
                formData.append('image', file);
                return api.upload('/api/upload/topo', formData);
            });

            const result = await Promise.all(uploadPromises);
            uploadedUrls = result.filter(res => !res.error).map(res => res.url);
        }

        const data = await api.post('/api/problems', { ...newProblem, image_urls: uploadedUrls });
        setIsSubmitting(false);

        // to do : change to Toast()
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

    const segmentBtn = (active: boolean) => ({
        flex: 1, padding: '7px 0', fontSize: '12px', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        background: active ? 'rgba(200,122,48,0.15)' : 'transparent',
        border: 'none',
        color: active ? '#c87a30' : '#6a5848',
        fontWeight: active ? 700 : 400,
        transition: 'all 0.2s',
        borderRadius: '8px'
    })

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
        }}>
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
                    {/* Multi-Image Picker */}
                    <div>
                        <div style={labelStyle}>Topo Photos</div>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                            {newProblem.imagePreviews.map((preview, idx) => (
                                <div key={idx} style={{ position: 'relative', minWidth: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                                    <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                                    <button
                                        onClick={() => {
                                            const newFiles = [...newProblem.imageFiles];
                                            const newPreviews = [...newProblem.imagePreviews];
                                            newFiles.splice(idx, 1);
                                            newPreviews.splice(idx, 1);
                                            setNewProblem({ ...newProblem, imageFiles: newFiles, imagePreviews: newPreviews });
                                        }}
                                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '10px' }}
                                    >✕</button>
                                </div>
                            ))}

                            <label style={{
                                minWidth: '100px', height: '100px', background: '#1a1612',
                                border: '1px dashed #4a3c30', borderRadius: '10px', cursor: 'pointer',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                color: '#6a5848', fontSize: '20px', flexShrink: 0
                            }}>
                                +
                                <span style={{ fontSize: '10px', marginTop: '4px' }}>Add Photo</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple // <-- Allows selecting multiple files at once!
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        const previews = files.map(f => URL.createObjectURL(f));
                                        setNewProblem({
                                            ...newProblem,
                                            imageFiles: [...newProblem.imageFiles, ...files],
                                            imagePreviews: [...newProblem.imagePreviews, ...previews]
                                        });
                                    }}
                                />
                            </label>
                        </div>
                    </div>

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

                        {/* Problem Type toggle */}
                        <div style={{ display: 'flex', gap: '4px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                            {(['boulder', 'rope'] as ProblemType[]).map(t => (
                                <button key={t} onClick={() => setProblemType(t)} style={segmentBtn(problemType === t)}>
                                    {t === 'boulder' ? '🪨 Boulder' : '🧗 Rope'}
                                </button>
                            ))}
                        </div>

                        {/* Scale toggle */}
                        <div style={{ display: 'flex', gap: '4px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                            {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                                <button key={scale} onClick={() => setGradeScale(scale)} style={segmentBtn(gradeScale === scale)}>
                                    {scale}
                                </button>
                            ))}
                        </div>

                        {/* Range toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#6a5848' }}>
                                {isRange
                                    ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                                    : newProblem.grade ? `Selected: ${newProblem.grade}` : 'Pick a grade'}
                            </span>
                            <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo('') }}
                                style={{
                                    fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                    background: isRange ? 'rgba(200,122,48,0.15)' : 'transparent',
                                    border: `1px solid ${isRange ? '#c87a30' : '#2a2420'}`,
                                    color: isRange ? '#c87a30' : '#6a5848',
                                    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s'
                                }}>
                                ⇔ Range
                            </button>
                        </div>

                        {/* Grade pills */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {grades.map(g => {
                                const isFrom = g === gradeFrom
                                const isTo = g === gradeTo
                                const inRange = isRange && gradeFrom && gradeTo
                                    ? grades.indexOf(g) > grades.indexOf(gradeFrom) && grades.indexOf(g) < grades.indexOf(gradeTo)
                                    : false
                                const active = isFrom || isTo || inRange

                                return (
                                    <button key={g} onClick={() => handleGradePick(g)} style={{
                                        padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                                        fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                                        background: isFrom || isTo ? 'rgba(200,122,48,0.2)' : inRange ? 'rgba(200,122,48,0.08)' : 'transparent',
                                        border: active ? '1px solid #c87a30' : '1px solid #2a2420',
                                        color: active ? '#c87a30' : '#6a5848',
                                        transition: 'all 0.15s'
                                    }}>{g}</button>
                                )
                            })}
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