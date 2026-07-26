import type { Shape } from '../../types/annotation.js'
import type { ContainRect } from './useContainRect.js'

type TopoAnnotationOverlayProps = {
    shapes: Shape[]
    rect: ContainRect | null
    previewShape?: Shape | null
}

// Pure/presentational: renders committed shapes (plus an optional in-progress
// preview shape) as an SVG positioned exactly over the visible image pixels.
// The viewBox is sized to the actual rendered pixel rect (not a normalized
// 0-1 square) so circles stay circular and strokes stay uniform-width even
// when the photo's aspect ratio doesn't match its container — see
// types/annotation.ts for why the normalization basis matters here.
export default function TopoAnnotationOverlay({ shapes, rect, previewShape }: TopoAnnotationOverlayProps) {
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
        </svg>
    )
}
