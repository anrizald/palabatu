// Mirrors palabatu-be/internal/devtools (see repository.go/service.go) --
// the owner-only Developer page's analytics dashboard and tester-management
// search. None of these fields carry `omitempty` on the Go side (except
// ActiveUser.Username, a `*string`), so every other key is always present.
export type DailyCount = {
    day: string
    count: number
}

export type VerificationCounts = {
    verified: number
    unverified: number
}

export type TopProblem = {
    id: string
    name: string
    sends: number
}

export type ActiveUser = {
    user_id: string
    username: string | null
    sends: number
    comments: number
    problems: number
}

export type Analytics = {
    signups_per_day: DailyCount[]
    problems_per_day: DailyCount[]
    sends_per_day: DailyCount[]
    verification: VerificationCounts
    top_problems: TopProblem[]
    active_users: ActiveUser[]
}

export type TesterCandidate = {
    id: string
    email: string
    username: string
    slug: string
    is_tester: boolean
}

export type ToggleTesterResponse = {
    is_tester: boolean
}
