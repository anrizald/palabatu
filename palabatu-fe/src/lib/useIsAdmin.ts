import { useEffect, useState } from 'react'
import { api } from './api.js'
import { useAuth } from './useAuth.js'
import type { Profile } from '../types/auth.js'
import type { ErrorResponse } from '../types/apitypes.js'

// Mirrors the isAdmin-via-title-fetch pattern already duplicated in
// Header.tsx/ProblemDetailPage.tsx/ProblemDetails.tsx (there's no
// AuthContext-level role field yet -- see the rbac-badge-rework note in
// CLAUDE.md/ROADMAP.md) -- shared here rather than re-duplicated a fourth
// time across the new crag/boulder pages.
export function useIsAdmin(): boolean {
    const { user } = useAuth()
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        if (!user?.id) { setIsAdmin(false); return }
        api.get<Profile | ErrorResponse>(`/api/profiles/${user.id}`).then(data => {
            if ('error' in data || !data.title) return
            const titles = typeof data.title === 'string' ? JSON.parse(data.title) : data.title
            setIsAdmin(Array.isArray(titles) && (titles.includes('Council') || titles.includes('Associate')))
        })
    }, [user])

    return isAdmin
}
