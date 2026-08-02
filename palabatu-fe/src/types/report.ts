// Mirrors the backend's report.Report (see palabatu-be/internal/report/repository.go
// and the generated internal_report.Report schema in src/types/api.d.ts). `target_type`
// is narrowed from the generated schema's plain `string` to the two values the backend
// actually sets (see internal/report/service.go).
export type Report = {
    id: string
    reporter_id: string
    reporter_name: string | null
    problem_id: string
    problem_name: string
    target_type: 'comment' | 'image'
    comment_id: string | null
    comment_content: string | null
    image_url: string | null
    reason: string | null
    status: string
    created_at: string
}
