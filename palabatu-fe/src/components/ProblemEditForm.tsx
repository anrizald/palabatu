import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { GRADE_SCALES, detectGradeScale, type ProblemType } from '../lib/constants.js';
import type { ProblemRow, TopoUploadResponse } from '../types/problem.js';
import type { ErrorResponse } from '../types/apitypes.js';
import { X } from 'lucide-react';

type ProblemEditFormProps = {
    problemId: string;
    initialGrade: string;
    name: string;
    onNameChange: (v: string) => void;
    locationName: string;
    onLocationNameChange: (v: string) => void;
    lat: number;
    lng: number;
    onPickLocation: () => void;
    onGradeChange: (grade: string) => void;
    images: string[];
    onImagesChange: (urls: string[]) => void;
    onSave: () => void;
    onCancel: () => void;
    isProcessing: boolean;
    onError: (message: string) => void;
};

function detectGrade(grade: string): { type: ProblemType; scale: string; from: string; to: string; isRange: boolean } {
    const isRange = grade.includes('-');
    const from = (isRange ? grade.split('-')[0] : grade) ?? '';
    const to = (isRange ? grade.split('-')[1] : '') ?? '';

    const detected = detectGradeScale(from);
    return { type: detected?.type ?? 'boulder', scale: detected?.scale ?? 'V-Scale', from, to, isRange };
}

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3 py-2.5 text-text-secondary text-sm outline-none box-border"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"
const segmentBtnClass = (active: boolean) =>
    `flex-1 py-[7px] text-xs font-sans border-0 rounded-lg cursor-pointer transition-all ${active ? 'bg-accent/15 text-accent font-bold' : 'bg-transparent text-text-dim font-normal'}`

// Shared grade-picker + name/location/coords/photos fields for editing a
// problem. Used by both the map's ProblemDetails modal and the
// /problems/:id detail page's inline edit block.
//
// Photos are mutated immediately (upload+attach on pick, destroy+detach on
// remove) rather than staged until Save -- unlike AddProblemModal, the
// problem already exists here so there's no "doesn't have an id yet"
// reason to defer. Newly attached photos become annotatable through the
// same TopoImage gallery used to display existing ones, so this form
// doesn't need its own annotation UI.
export default function ProblemEditForm({
    problemId, initialGrade, name, onNameChange, locationName, onLocationNameChange,
    lat, lng, onPickLocation, onGradeChange, images, onImagesChange, onSave, onCancel, isProcessing, onError,
}: ProblemEditFormProps) {
    const [detected] = useState(() => detectGrade(initialGrade));
    const [problemType, setProblemType] = useState<ProblemType>(detected.type);
    const [gradeScale, setGradeScale] = useState<string>(detected.scale);
    const [isRange, setIsRange] = useState(detected.isRange);
    const [gradeFrom, setGradeFrom] = useState(detected.from);
    const [gradeTo, setGradeTo] = useState(detected.to);

    const [isUploadingImages, setIsUploadingImages] = useState(false);
    const [removingUrl, setRemovingUrl] = useState<string | null>(null);

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

    const handleAddPhotos = async (files: File[]) => {
        if (files.length === 0) return;
        setIsUploadingImages(true);

        try {
            const uploads = await Promise.all(files.map(file => {
                const formData = new FormData();
                formData.append('image', file);
                return api.upload<Partial<TopoUploadResponse & ErrorResponse>>('/api/upload/topo', formData);
            }));

            const uploadedUrls = uploads.filter((r): r is TopoUploadResponse => !!r.url).map(r => r.url);
            if (uploadedUrls.length < files.length) {
                onError(`${files.length - uploadedUrls.length} photo(s) failed to upload`);
            }
            if (uploadedUrls.length === 0) return;

            const res = await api.post<Partial<ProblemRow & ErrorResponse>>(`/api/problems/${problemId}/images`, { image_urls: uploadedUrls });
            if (res.error || !res.image_urls) {
                onError(`Failed to attach photos: ${res.error ?? 'Server error'}`);
            } else {
                onImagesChange(res.image_urls);
            }
        } catch (e) {
            console.error('Photo upload failed', e);
            onError('Failed to upload photos. Check your connection.');
        } finally {
            setIsUploadingImages(false);
        }
    };

    const handleRemovePhoto = async (url: string) => {
        if (!window.confirm('Remove this photo?')) return;
        setRemovingUrl(url);

        try {
            const res = await api.delete<Partial<ErrorResponse>>(`/api/problems/${problemId}/images`, { url });
            if (res.error) {
                onError(`Failed to remove photo: ${res.error}`);
            } else {
                onImagesChange(images.filter(u => u !== url));
            }
        } catch (e) {
            console.error('Photo remove failed', e);
            onError('Failed to remove photo. Check your connection.');
        } finally {
            setRemovingUrl(null);
        }
    };

    return (
        <div className="mt-4 flex flex-col gap-3">
            {/* Photos */}
            <div>
                <div className={labelClass}>Topo Photos</div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((url) => (
                        <div key={url} className="relative min-w-[84px] h-[84px] rounded-[10px] overflow-hidden shrink-0">
                            <img src={url} className="w-full h-full object-cover" alt="Topo" />
                            <button
                                onClick={() => handleRemovePhoto(url)}
                                disabled={removingUrl === url}
                                className="absolute top-1 right-1 bg-black/60 text-white border-0 rounded-full w-6 h-6 cursor-pointer flex items-center justify-center disabled:opacity-50"
                                aria-label="Remove photo"
                            ><X size={14} className="shrink-0" /></button>
                        </div>
                    ))}

                    <label className={`min-w-[84px] h-[84px] bg-surface border border-dashed border-text-faint rounded-[10px] flex flex-col items-center justify-center text-text-dim text-xl shrink-0 ${isUploadingImages ? 'opacity-50' : 'cursor-pointer'}`}>
                        +
                        <span className="text-[10px] mt-1">{isUploadingImages ? 'Uploading...' : 'Add Photo'}</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isUploadingImages}
                            className="hidden"
                            onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                e.target.value = '';
                                handleAddPhotos(files);
                            }}
                        />
                    </label>
                </div>
            </div>

            {/* Name */}
            <div>
                <div className={labelClass}>Problem Name</div>
                <input
                    value={name}
                    onChange={e => onNameChange(e.target.value)}
                    placeholder="e.g. Slab Mantap"
                    className={inputClass}
                />
            </div>

            {/* Grade */}
            <div>
                <div className={labelClass}>Grade</div>

                <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                    {(['boulder', 'rope'] as ProblemType[]).map(t => (
                        <button key={t} onClick={() => { setProblemType(t); setGradeFrom(''); setGradeTo(''); }} className={segmentBtnClass(problemType === t)}>
                            {t === 'boulder' ? 'Boulder' : 'Rope'}
                        </button>
                    ))}
                </div>

                <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 mb-2.5">
                    {Object.keys(GRADE_SCALES[problemType]).map(scale => (
                        <button key={scale} onClick={() => { setGradeScale(scale); setGradeFrom(''); setGradeTo(''); }} className={segmentBtnClass(gradeScale === scale)}>
                            {scale}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs text-text-dim">
                        {isRange
                            ? gradeFrom && gradeTo ? `Range: ${gradeFrom} – ${gradeTo}` : gradeFrom ? `From ${gradeFrom}, pick upper…` : 'Pick lower grade first'
                            : gradeFrom ? `Selected: ${gradeFrom}` : 'Pick a grade'}
                    </span>
                    <button onClick={() => { setIsRange(r => !r); setGradeFrom(''); setGradeTo(''); }}
                        className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer font-sans transition-all border ${isRange ? 'bg-accent/15 border-accent text-accent' : 'bg-transparent border-border text-text-dim'}`}>
                        Range
                    </button>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                    {grades.map(g => {
                        const isFrom = g === gradeFrom;
                        const isTo = g === gradeTo;
                        const inRange = isRange && gradeFrom && gradeTo
                            ? grades.indexOf(g) > grades.indexOf(gradeFrom) && grades.indexOf(g) < grades.indexOf(gradeTo)
                            : false;
                        const active = isFrom || isTo || inRange;

                        return (
                            <button key={g} onClick={() => handleGradePick(g)} className={`py-1.5 px-3 rounded-full text-xs font-sans cursor-pointer transition-all border ${active ? 'border-accent text-accent' : 'border-border text-text-dim'} ${isFrom || isTo ? 'bg-accent/20' : inRange ? 'bg-accent/[0.08]' : 'bg-transparent'}`}>{g}</button>
                        );
                    })}
                </div>
            </div>

            {/* Location */}
            <div>
                <div className={labelClass}>Location Name</div>
                <input
                    value={locationName}
                    onChange={e => onLocationNameChange(e.target.value)}
                    placeholder="e.g. Parang, Jawa Barat"
                    className={inputClass}
                />
            </div>

            {/* Pinpoint */}
            <div>
                <div className={labelClass}>Location on Map</div>
                <div className="flex gap-2 items-center">
                    <div className="flex-1 px-3.5 py-2.5 bg-associate/10 border border-associate rounded-[10px] text-associate text-[13px]">
                        {lat?.toFixed(4)}, {lng?.toFixed(4)}
                    </div>
                    <button
                        type="button"
                        onClick={onPickLocation}
                        className="px-3.5 py-2.5 bg-accent/10 border border-accent/25 text-accent rounded-[10px] cursor-pointer text-xs whitespace-nowrap"
                    >
                        Change
                    </button>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button onClick={onSave} disabled={isProcessing} className="flex-1 p-2 bg-accent/10 border border-accent/25 text-accent rounded-lg cursor-pointer text-xs">
                    {isProcessing ? 'Saving...' : 'Save'}
                </button>
                <button onClick={onCancel} className="flex-1 p-2 bg-white/5 border border-border text-text-muted rounded-lg cursor-pointer text-xs">
                    Cancel
                </button>
            </div>
        </div>
    );
}
