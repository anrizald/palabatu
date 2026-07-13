import { useEffect, useState } from 'react';
import { GRADE_SCALES, type ProblemType } from '../lib/constants.js';

type ProblemEditFormProps = {
    initialGrade: string;
    name: string;
    onNameChange: (v: string) => void;
    locationName: string;
    onLocationNameChange: (v: string) => void;
    lat: number;
    lng: number;
    onPickLocation: () => void;
    onGradeChange: (grade: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isProcessing: boolean;
};

function detectGrade(grade: string): { type: ProblemType; scale: string; from: string; to: string; isRange: boolean } {
    const isRange = grade.includes('-');
    const from = (isRange ? grade.split('-')[0] : grade) ?? '';
    const to = (isRange ? grade.split('-')[1] : '') ?? '';

    for (const [ptype, scales] of Object.entries(GRADE_SCALES)) {
        for (const [scaleName, gradesArray] of Object.entries(scales as Record<string, readonly string[]>)) {
            if (gradesArray.includes(from)) {
                return { type: ptype as ProblemType, scale: scaleName, from, to, isRange };
            }
        }
    }
    return { type: 'boulder', scale: 'V-Scale', from, to, isRange };
}

const segmentBtn = (active: boolean) => ({
    flex: 1, padding: '7px 0', fontSize: '12px', cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    background: active ? 'rgba(200,122,48,0.15)' : 'transparent',
    border: 'none', color: active ? '#c87a30' : '#6a5848',
    fontWeight: active ? 700 : 400, transition: 'all 0.2s', borderRadius: '8px'
});

// Shared inline-styled grade-picker + name/location/coords fields for
// editing a problem. Used by both the map's ProblemDetails modal and
// the /problems/:id detail page's inline edit block.
export default function ProblemEditForm({
    initialGrade, name, onNameChange, locationName, onLocationNameChange,
    lat, lng, onPickLocation, onGradeChange, onSave, onCancel, isProcessing,
}: ProblemEditFormProps) {
    const [detected] = useState(() => detectGrade(initialGrade));
    const [problemType, setProblemType] = useState<ProblemType>(detected.type);
    const [gradeScale, setGradeScale] = useState<string>(detected.scale);
    const [isRange, setIsRange] = useState(detected.isRange);
    const [gradeFrom, setGradeFrom] = useState(detected.from);
    const [gradeTo, setGradeTo] = useState(detected.to);

    const currentScales = GRADE_SCALES[problemType] as Record<string, readonly string[]>;
    const grades: readonly string[] = currentScales[gradeScale] || [];

    useEffect(() => {
        if (!gradeFrom) return;
        onGradeChange(isRange && gradeTo ? `${gradeFrom}-${gradeTo}` : gradeFrom);
        // onGradeChange intentionally excluded: only re-run when the picker's own selection changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    return (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Name */}
            <div>
                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Problem Name</div>
                <input
                    value={name}
                    onChange={e => onNameChange(e.target.value)}
                    placeholder="e.g. Slab Mantap"
                    style={{ width: '100%', background: '#1a1612', border: '1px solid #2a2420', padding: '10px 12px', borderRadius: '10px', color: '#d8c8b8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
            </div>

            {/* Grade */}
            <div>
                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Grade</div>

                <div style={{ display: 'flex', gap: '4px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                    {(['boulder', 'rope'] as ProblemType[]).map(t => (
                        <button key={t} onClick={() => { setProblemType(t); setGradeFrom(''); setGradeTo(''); }} style={segmentBtn(problemType === t)}>
                            {t === 'boulder' ? 'Boulder' : 'Rope'}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '4px', background: '#1a1612', border: '1px solid #2a2420', borderRadius: '10px', padding: '4px', marginBottom: '10px' }}>
                    {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                        <button key={scale} onClick={() => { setGradeScale(scale); setGradeFrom(''); setGradeTo(''); }} style={segmentBtn(gradeScale === scale)}>
                            {scale}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#6a5848' }}>
                        {isRange
                            ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                            : gradeFrom ? `Selected: ${gradeFrom}` : 'Pick a grade'}
                    </span>
                    <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo(''); }}
                        style={{
                            fontSize: '11px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                            background: isRange ? 'rgba(200,122,48,0.15)' : 'transparent',
                            border: `1px solid ${isRange ? '#c87a30' : '#2a2420'}`,
                            color: isRange ? '#c87a30' : '#6a5848', transition: 'all 0.2s'
                        }}>
                        Range
                    </button>
                </div>

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
                    value={locationName}
                    onChange={e => onLocationNameChange(e.target.value)}
                    placeholder="e.g. Parang, Jawa Barat"
                    style={{ width: '100%', background: '#1a1612', border: '1px solid #2a2420', padding: '10px 12px', borderRadius: '10px', color: '#d8c8b8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
            </div>

            {/* Pinpoint */}
            <div>
                <div style={{ fontSize: '11px', color: '#6a5848', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Location on Map</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(93,187,106,0.1)', border: '1px solid #5dbb6a', borderRadius: '10px', color: '#5dbb6a', fontSize: '13px' }}>
                        {lat?.toFixed(4)}, {lng?.toFixed(4)}
                    </div>
                    <button
                        type="button"
                        onClick={onPickLocation}
                        style={{ padding: '10px 14px', background: 'rgba(200,122,48,0.1)', border: '1px solid #c87a3040', color: '#c87a30', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                        Change
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onSave} disabled={isProcessing} style={{ flex: 1, padding: '8px', background: 'rgba(200,122,48,0.1)', border: '1px solid #c87a3040', color: '#c87a30', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    {isProcessing ? 'Saving...' : 'Save'}
                </button>
                <button onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2420', color: '#8a7060', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
