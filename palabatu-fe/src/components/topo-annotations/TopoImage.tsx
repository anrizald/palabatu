import { useState, type CSSProperties } from 'react'
import { Pencil } from 'lucide-react'
import type { Shape } from '../../types/annotation.js'
import { useContainRect } from './useContainRect.js'
import TopoAnnotationOverlay from './TopoAnnotationOverlay.js'
import TopoAnnotationEditor from './TopoAnnotationEditor.js'

type TopoImageProps = {
    problemId: string
    url: string
    shapes: Shape[]
    canEdit: boolean
    canReport: boolean
    onReport: () => void
    onSaved: (shapes: Shape[]) => void
    style?: CSSProperties
    className?: string
}

const buttonStyle: CSSProperties = {
    position: 'absolute', background: 'rgba(20,18,16,0.75)', backdropFilter: 'blur(6px)',
    border: '1px solid #2a2420', color: '#f0e0c8',
    width: '28px', height: '28px', borderRadius: '50%',
    cursor: 'pointer', fontSize: '13px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// Shared image + read-only annotation overlay, used by both ProblemDetails
// (modal) and ProblemDetailPage (dedicated page) so their overlay geometry
// can never drift apart. Letterboxed like object-fit: contain (not cropped
// like cover) so an annotation never gets misaligned against pixels a crop
// would have hidden — but sized via maxWidth/maxHeight + flex-centering
// rather than objectFit itself, so the <img>'s own box always matches its
// visible content for useContainRect to measure (see that hook's note).
export default function TopoImage({ problemId, url, shapes, canEdit, canReport, onReport, onSaved, style, className }: TopoImageProps) {
    const { containerRef, imgRef, rect } = useContainRect()
    const [isEditing, setIsEditing] = useState(false)

    return (
        <div ref={containerRef} className={className} style={{
            position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...style,
        }}>
            <img
                ref={imgRef}
                src={url}
                alt="Topo"
                style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
            />
            <TopoAnnotationOverlay shapes={shapes} rect={rect} />

            {canReport && (
                <button onClick={onReport} title="Report image" style={{ ...buttonStyle, top: '8px', right: '8px' }}>
                    ⚑
                </button>
            )}

            {canEdit && (
                <button onClick={() => setIsEditing(true)} title="Annotate route" style={{ ...buttonStyle, top: '8px', left: '8px' }}>
                    {/* flexShrink: 0 works around lucide SVGs rendering at 0 width
                        inside a display:flex button — see TopoAnnotationEditor's
                        ICON_FLEX_FIX for the fuller note. */}
                    <Pencil size={14} style={{ flexShrink: 0 }} />
                </button>
            )}

            {isEditing && (
                <TopoAnnotationEditor
                    problemId={problemId}
                    url={url}
                    initialShapes={shapes}
                    onCancel={() => setIsEditing(false)}
                    onSaved={(newShapes) => { onSaved(newShapes); setIsEditing(false) }}
                />
            )}
        </div>
    )
}
