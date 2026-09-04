// Mirrors palabatu-be/internal/feedback (see repository.go) -- the global
// feedback/bug-report form and its owner-only review list. UserID/Username/
// Email/PageURL are all `*string` on the Go side, so nullable here.
export type FeedbackItem = {
    id: string
    user_id: string | null
    username: string | null
    email: string | null
    type: FeedbackType
    message: string
    page_url: string | null
    status: string
    created_at: string
}

// Mirrors the set enforced by migrations/0018_feedback_type's check
// constraint and feedback.validFeedbackTypes (service.go).
export type FeedbackType = 'feedback' | 'bug' | 'report' | 'suggestion'

// Drives FeedbackModal's type dropdown -- label plus the helper copy shown
// beneath it for that selection. Order here is the dropdown's order.
export const FEEDBACK_TYPES: { value: FeedbackType; label: string; description: string }[] = [
    { value: 'feedback', label: 'Feedback', description: 'General thoughts, praise, or comments about using Palabatu.' },
    { value: 'bug', label: 'Bug', description: 'Something broke or didn\'t work as expected. Include what happened, what you expected instead, and how to reproduce it.' },
    { value: 'report', label: 'Report', description: 'Flag something wrong with the app\'s content, such as a bad grade, stale directions, or a duplicate spot that needs a second look.' },
    { value: 'suggestion', label: 'Suggestion', description: 'An idea for a new feature or a way to make Palabatu better.' },
]
