// Shapes are stored with coordinates normalized to the image's *natural*
// pixel dimensions: points/center are [x / naturalWidth, y / naturalHeight];
// radius/strokeWidth are normalized against width for both axes, so a
// circle stays circular and a stroke stays uniform-width regardless of the
// photo's aspect ratio or the size it's currently rendered at. See
// TopoAnnotationOverlay for the corresponding pixel conversion.

export type Stroke = {
    id: string
    type: 'stroke'
    color: string
    strokeWidth: number
    points: [number, number][]
}

export type CircleShape = {
    id: string
    type: 'circle'
    color: string
    strokeWidth: number
    center: [number, number]
    radius: number
}

export type Shape = Stroke | CircleShape

// Default outline weight for newly drawn shapes, normalized against image
// width like every other size quantity (see the note above).
export const DEFAULT_STROKE_WIDTH = 0.006

export type AnnotationRecord = {
    id: string
    problem_id: string
    image_url: string
    data: Shape[]
    updated_by: string | null
    created_at: string
    updated_at: string
}

export const ANNOTATION_COLORS = ['#ffffff', '#ef4444', '#facc15', '#3b82f6', '#22c55e'] as const
