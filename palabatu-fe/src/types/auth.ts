// Mirrors palabatu-be/internal/auth (see repository.go/service.go/dto.go and
// the generated internal_auth.* schemas in src/types/api.d.ts). None of these
// fields carry `omitempty` on the Go side, so every key is always present.

export type User = {
    id: string
    email: string
    username: string
    slug: string
}

// Profile.title/tags are passed through as opaque JSON on the backend
// (json.RawMessage) -- title is nominally a JSON array of role strings but
// has legacy rows that aren't (some pre-date the array convention and store
// a JSON-encoded string instead), and tags is a frontend-defined shape
// ({ level, styles }). Left as `unknown` rather than a clean shape so
// consumers keep doing the defensive typeof/parse check that legacy data
// actually requires.
export type Profile = {
    id: string
    slug: string
    username: string | null
    title: unknown
    tags: unknown
    avatar_url: string | null
    bio: string | null
    location: string | null
    created_at: string
}

export type ProfileStats = {
    sends_count: number
    problems_count: number
}

export type RecentSend = {
    problem_id: string
    problem_name: string
    grade: string | null
    created_at: string
}

export type RecentProblem = {
    id: string
    name: string
    grade: string | null
    created_at: string
}

export type RecentActivity = {
    sends: RecentSend[]
    problems: RecentProblem[]
}

export type SigninResponse = {
    user: User
    token: string
}

export type SessionResponse = {
    user: User
}
