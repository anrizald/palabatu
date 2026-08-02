// Mirrors palabatu-be/internal/waitlist (see repository.go/handler.go and the
// generated internal_waitlist.* schemas in src/types/api.d.ts).
export type Subscriber = {
    id: string
    email: string
    created_at: string
}

export type AlreadyJoinedResponse = {
    already_joined: boolean
}
