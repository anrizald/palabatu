// Wizard-only orchestration drafts -- not a mirror of any backend shape
// (that's what src/types/crag.ts and src/types/boulder.ts are for), just
// the in-progress "create a new one" sub-forms shared between AddFlow and
// its two picker steps.

export type NewSpotDraft = {
    name: string
    directions: string
    access_notes: string
}

export type NewRockDraft = {
    name: string
    rock_type: string
    imageFiles: File[]
    imagePreviews: string[]
}
