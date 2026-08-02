import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Pencil, Circle as CircleIcon, Undo2, Trash2, X, Check } from 'lucide-react'
import { api } from '../../lib/api.js'
import { ANNOTATION_COLORS, DEFAULT_STROKE_WIDTH, type Shape, type AnnotationRecord } from '../../types/annotation.js'
import { useContainRect } from './useContainRect.js'
import TopoAnnotationOverlay from './TopoAnnotationOverlay.js'
import type { ErrorResponse } from '../../types/apitypes.js'

type Tool = 'pen' | 'circle'

type TopoAnnotationEditorProps = {
    // Omitted when annotating a photo that isn't attached to a saved problem
    // yet (AddProblemModal's preview thumbnails, before the "Add Problem"
    // submit): Save then skips the network call and just hands shapes back
    // to the caller via onSaved, to be persisted once a problem_id exists.
    problemId?: string
    url: string
    initialShapes: Shape[]
    onCancel: () => void
    onSaved: (shapes: Shape[]) => void
}

const genId = () => Math.random().toString(36).slice(2, 10)
const MIN_POINT_DISTANCE_PX = 2
const MIN_CIRCLE_RADIUS = 0.002

// Without this, these icons render at 0 rendered width (confirmed via
// getComputedStyle — height resolves to 16px but width to 0px) even though
// the SVG markup, currentColor, and computed color all check out — a
// lucide SVG's intrinsic width doesn't reliably survive being a flex
// item's auto min-width in this app (seen both nested several nested flex
// containers deep here, and just one level deep on TopoImage's edit
// button). Forcing flex-shrink: 0 fixes it; apply to any new icon added
// inside a display:flex button in this codebase.
const ICON_FLEX_FIX: CSSProperties = { flexShrink: 0 }

// Near-fullscreen modal (not squeezed into the small carousel thumbnail —
// there isn't room to draw precisely there, especially with a finger on
// mobile), reusing ReportModal's established dark-overlay visual language
// so it looks consistent whichever page opened it. Draws into the same
// TopoAnnotationOverlay the read-only viewer uses (passed the in-progress
// shape as a live preview), so there is exactly one shape-rendering path.
export default function TopoAnnotationEditor({ problemId, url, initialShapes, onCancel, onSaved }: TopoAnnotationEditorProps) {
    const [shapes, setShapes] = useState<Shape[]>(initialShapes)
    const [tool, setTool] = useState<Tool>('pen')
    const [color, setColor] = useState<string>(ANNOTATION_COLORS[0])
    const [draft, setDraft] = useState<Shape | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { containerRef, imgRef, rect } = useContainRect()
    const drawingRef = useRef<HTMLDivElement>(null)
    const draftingRef = useRef(false)

    const toNormalized = (e: ReactPointerEvent): [number, number] | null => {
        if (!rect || !drawingRef.current) return null
        const box = drawingRef.current.getBoundingClientRect()
        const px = e.clientX - box.left - rect.left
        const py = e.clientY - box.top - rect.top
        return [Math.min(Math.max(px / rect.width, 0), 1), Math.min(Math.max(py / rect.height, 0), 1)]
    }

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        const point = toNormalized(e)
        if (!point) return
        e.currentTarget.setPointerCapture(e.pointerId)
        draftingRef.current = true

        setDraft(
            tool === 'pen'
                ? { id: genId(), type: 'stroke', color, strokeWidth: DEFAULT_STROKE_WIDTH, points: [point] }
                : { id: genId(), type: 'circle', color, strokeWidth: DEFAULT_STROKE_WIDTH, center: point, radius: 0 }
        )
    }

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!draftingRef.current || !rect) return
        const point = toNormalized(e)
        if (!point) return

        setDraft(prev => {
            if (!prev) return prev
            if (prev.type === 'stroke') {
                const last = prev.points[prev.points.length - 1]
                if (!last) return prev
                const dist = Math.hypot((point[0] - last[0]) * rect.width, (point[1] - last[1]) * rect.height)
                if (dist < MIN_POINT_DISTANCE_PX) return prev
                return { ...prev, points: [...prev.points, point] }
            }
            const radius = Math.hypot((point[0] - prev.center[0]) * rect.width, (point[1] - prev.center[1]) * rect.height) / rect.width
            return { ...prev, radius }
        })
    }

    const commitDraft = () => {
        draftingRef.current = false
        setDraft(prev => {
            if (prev) {
                const isEmpty = prev.type === 'stroke' ? prev.points.length < 2 : prev.radius < MIN_CIRCLE_RADIUS
                if (!isEmpty) setShapes(s => [...s, prev])
            }
            return null
        })
    }

    const handlePointerCancel = () => { draftingRef.current = false; setDraft(null) }

    const handleUndo = () => setShapes(s => s.slice(0, -1))
    const handleClear = () => setShapes([])

    const handleSave = async () => {
        if (!problemId) {
            onSaved(shapes)
            return
        }

        setIsSaving(true)
        setError(null)
        try {
            const res = await api.put<Partial<AnnotationRecord & ErrorResponse>>(`/api/problems/${problemId}/annotations`, { url, data: shapes })
            if (res?.error) {
                setError(res.error)
                return
            }
            onSaved(Array.isArray(res?.data) ? res.data : shapes)
        } catch {
            setError('Failed to save. Try again.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div
            onClick={onCancel}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10, 9, 8, 0.85)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 10002, padding: '16px',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#141210', border: '1px solid #2a2420', borderRadius: '20px',
                    width: '100%', maxWidth: '900px', maxHeight: '92vh',
                    fontFamily: "'DM Sans', sans-serif", color: '#f0e0c8',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                <div style={{
                    padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid #2a2420', flexShrink: 0,
                }}>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', margin: 0 }}>
                        Annotate Route
                    </h3>
                    <button onClick={onCancel} style={{
                        background: 'none', border: 'none', color: '#8a7060', fontSize: '22px', cursor: 'pointer', lineHeight: 1,
                    }}>&times;</button>
                </div>

                <div
                    ref={containerRef}
                    style={{
                        position: 'relative', flex: 1, minHeight: '320px', background: '#0a0908', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <img
                        ref={imgRef}
                        src={url}
                        alt="Topo"
                        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
                        draggable={false}
                    />
                    <TopoAnnotationOverlay shapes={shapes} rect={rect} previewShape={draft} />
                    <div
                        ref={drawingRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={commitDraft}
                        onPointerCancel={handlePointerCancel}
                        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair' }}
                    />
                </div>

                {error && (
                    <div style={{ padding: '8px 20px', color: '#dc3545', fontSize: '12px', flexShrink: 0 }}>{error}</div>
                )}

                <div style={{
                    padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px',
                    borderTop: '1px solid #2a2420', flexWrap: 'wrap', flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setTool('pen')} title="Pen" style={toolButtonStyle(tool === 'pen')}>
                            <Pencil size={16} style={ICON_FLEX_FIX} />
                        </button>
                        <button onClick={() => setTool('circle')} title="Circle" style={toolButtonStyle(tool === 'circle')}>
                            <CircleIcon size={16} style={ICON_FLEX_FIX} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                        {ANNOTATION_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                title={c}
                                style={{
                                    width: '22px', height: '22px', borderRadius: '50%', background: c,
                                    border: color === c ? '2px solid #c87a30' : '1px solid #2a2420',
                                    cursor: 'pointer', padding: 0,
                                }}
                            />
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                        <button onClick={handleUndo} disabled={shapes.length === 0} title="Undo" style={iconButtonStyle(shapes.length === 0)}>
                            <Undo2 size={16} style={ICON_FLEX_FIX} />
                        </button>
                        <button onClick={handleClear} disabled={shapes.length === 0} title="Clear all" style={iconButtonStyle(shapes.length === 0)}>
                            <Trash2 size={16} style={ICON_FLEX_FIX} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button
                            onClick={onCancel}
                            style={{
                                flex: '1 1 120px', padding: '10px', background: 'transparent',
                                border: '1px solid #2a2420', borderRadius: '10px', color: '#8a7060',
                                fontSize: '13px', cursor: 'pointer',
                            }}
                        >
                            <X size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                flex: '1 1 120px', padding: '10px', background: 'rgba(200,122,48,0.15)',
                                border: '1px solid rgba(200,122,48,0.4)', borderRadius: '10px', color: '#c87a30',
                                fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                                opacity: isSaving ? 0.6 : 1,
                            }}
                        >
                            <Check size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            {!problemId ? 'Done' : isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function toolButtonStyle(active: boolean): CSSProperties {
    return {
        width: '32px', height: '32px', borderRadius: '8px',
        background: active ? 'rgba(200,122,48,0.2)' : 'transparent',
        border: active ? '1px solid #c87a30' : '1px solid #2a2420',
        color: active ? '#c87a30' : '#8a7060',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }
}

function iconButtonStyle(disabled: boolean): CSSProperties {
    return {
        width: '32px', height: '32px', borderRadius: '8px',
        background: 'transparent', border: '1px solid #2a2420',
        color: disabled ? '#4a4038' : '#8a7060',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }
}
