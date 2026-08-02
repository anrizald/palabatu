// Mirrors palabatu-be/internal/feedback (see repository.go) -- the global
// feedback/bug-report form and its owner-only review list. UserID/Username/
// Email/PageURL are all `*string` on the Go side, so nullable here.
export type FeedbackItem = {
    id: string
    user_id: string | null
    username: string | null
    email: string | null
    message: string
    page_url: string | null
    status: string
    created_at: string
}
