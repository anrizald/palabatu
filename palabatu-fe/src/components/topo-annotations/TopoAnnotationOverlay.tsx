import type { Shape } from '../../types/annotation.js'
import type { ContainRect } from './useContainRect.js'

type TopoAnnotationOverlayProps = {
    shapes: Shape[]
    rect: ContainRect | null
    previewShape?: Shape | null
    /** Label each shape that has a pitch with "P2" and so on, at its start.
     * Off by default: the every-line-on-this-rock view lays several routes
     * over one photo, where each route's own "P1" would mean nothing. */
    showPitchLabels?: boolean
}

// Pure/presentational: renders committed shapes (plus an optional in-progress
// preview shape) as an SVG positioned exactly over the visible image pixels.
// The viewBox is sized to the actual rendered pixel rect (not a normalized
// 0-1 square) so circles stay circular and strokes stay uniform-width even
// when the photo's aspect ratio doesn't match its container — see
// types/annotation.ts for why the normalization basis matters here.
export default function TopoAnnotationOverlay({ shapes, rect, previewShape, showPitchLabels = false }: TopoAnnotationOverlayProps) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return null

    const allShapes = previewShape ? [...shapes, previewShape] : shapes
    if (allShapes.length === 0) return null

    return (
        <svg
            style={{
                position: 'absolute',
                left: rect.left, top: rect.top, width: rect.width, height: rect.height,
                pointerEvents: 'none',
            }}
            viewBox={`0 0 ${rect.width} ${rect.height}`}
        >
            {allShapes.map(shape => {
                if (shape.type === 'stroke') {
                    if (shape.points.length === 0) return null
                    const points = shape.points.map(([x, y]) => `${x * rect.width},${y * rect.height}`).join(' ')
                    return (
                        <polyline
                            key={shape.id}
                            points={points}
                            fill="none"
                            stroke={shape.color}
                            strokeWidth={Math.max(shape.strokeWidth * rect.width, 1)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )
                }

                return (
                    <circle
                        key={shape.id}
                        cx={shape.center[0] * rect.width}
                        cy={shape.center[1] * rect.height}
                        r={Math.max(shape.radius * rect.width, 1)}
                        fill="none"
                        stroke={shape.color}
                        strokeWidth={Math.max(shape.strokeWidth * rect.width, 1)}
                    />
                )
            })}
            {showPitchLabels && allShapes.map(shape => {
                if (shape.pitch == null) return null
                const anchor = shape.type === 'stroke' ? shape.points[0] : shape.center
                if (!anchor) return null
                // Kept inside the image so a line starting at an edge still
                // has a readable label.
                const x = Math.min(Math.max(anchor[0] * rect.width, 4), Math.max(rect.width - 28, 4))
                const y = Math.min(Math.max(anchor[1] * rect.height - 6, 14), rect.height - 4)
                return (
                    <text
                        key={`pitch-${shape.id}`}
                        x={x}
                        y={y}
                        fill={shape.color}
                        stroke="#0a0908"
                        strokeWidth={3}
                        paintOrder="stroke"
                        fontSize={12}
                        fontWeight={700}
                        fontFamily="'DM Sans', sans-serif"
                    >
                        P{shape.pitch}
                    </text>
                )
            })}
        </svg>
    )
}
