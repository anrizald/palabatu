import { useCallback, useState, type ReactNode } from 'react'
import AddSheet from '../components/add-sheet/AddSheet.js'
import Toast, { type ToastProps } from '../components/Toast.js'
import { useAuth } from './useAuth.js'
import { AddSheetContext, type OpenAddSheetOptions } from './addSheetContextInstance.js'

// Mounted once at the app root (handoff-directory.md decision 10) rather
// than inside Map.tsx, so every entry point -- the map FAB, a crag/boulder
// page's "Add a rock"/"Add a problem", the directory's CTA -- opens the
// same sheet in place instead of bouncing through /map first (finding 8).
// AddSheet itself still portals to document.body (load-bearing against
// Footer.tsx's fixed positioning, see handoff-add-sheet.md), so where this
// provider sits in the tree only decides its React lifecycle, not where it
// paints -- and mounting it above <Routes> is what lets it survive a route
// change instead of unmounting with whatever page opened it.
export function AddSheetProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [session, setSession] = useState<OpenAddSheetOptions | null>(null)
    const [toast, setToast] = useState<ToastProps | null>(null)

    const openAddSheet = useCallback((options?: OpenAddSheetOptions) => {
        if (!user) {
            setToast({ message: 'Please log in to add a problem', type: 'error', onClose: () => setToast(null) })
            return
        }
        setSession(options ?? {})
    }, [user])

    const close = () => setSession(null)

    return (
        <AddSheetContext.Provider value={{ openAddSheet }}>
            {children}
            {toast && <Toast {...toast} />}
            {session && (
                <AddSheet
                    onClose={close}
                    onAdded={() => session.onAdded?.()}
                    {...(session.intent ? { initialIntent: session.intent } : {})}
                    {...(session.cragId ? { initialCragId: session.cragId } : {})}
                    {...(session.boulderId ? { initialBoulderId: session.boulderId } : {})}
                />
            )}
        </AddSheetContext.Provider>
    )
}
