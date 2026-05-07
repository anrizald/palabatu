export type NewProblem = {
    name: string
    grade: string
    location: string
    lat: number | null
    lng: number | null
    imageFiles: File[]
    imagePreviews: string[]
}

export type ProblemRow = {
    id: string | number
    name: string
    location_name: string
    latitude: number
    longitude: number
    grade: string
    creator_name: string
    created_by: string
}