// Shapes are stored with coordinates normalized to the image's *natural*
// pixel dimensions: points/center are [x / naturalWidth, y / naturalHeight];
// radius/strokeWidth are normalized against width for both axes, so a
// circle stays circular and a stroke stays uniform-width regardless of the
// photo's aspect ratio or the size it's currently rendered at. See
// TopoAnnotationOverlay for the corresponding pixel conversion.

// pitch is which pitch of a multi-pitch route a shape belongs to (handoff.md
// open item 14, decision 23's first follow-on). Absent means "not tied to a
// pitch", which is every shape drawn before this existed and every line on a
// single-pitch route. It lives on the shape, inside the one `data` array a
// problem already keeps per photo, rather than in topo_annotations' key: that
// needs no migration and leaves the every-line-on-this-rock view untouched,
// where splitting a drawing across rows per pitch would make that view
// reassemble them. The backend passes `data` through opaquely, so it needs no
// change either.
export type Stroke = {
    id: string
    type: 'stroke'
    color: string
    strokeWidth: number
    points: [number, number][]
    pitch?: number
}

export type CircleShape = {
    id: string
    type: 'circle'
    color: string
    strokeWidth: number
    center: [number, number]
    radius: number
    pitch?: number
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
