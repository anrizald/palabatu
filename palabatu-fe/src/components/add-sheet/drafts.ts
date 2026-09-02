// Add-sheet draft persistence -- handoff-drafts.md Milestone 1 (client-side
// only, no backend). One IndexedDB object store; each row is a direct
// snapshot of the sheet's own existing state shapes (types.ts), so there is
// no parallel model to keep in sync. File objects serialize into IndexedDB
// natively (structured clone supports Blob/File) -- no upload needed for M1.
import type { AddIntent, NewSpotDraft, NewRockDraft, NewProblemDraft } from './types.js'

const DB_NAME = 'palabatu-add-sheet-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

export type AddSheetDraft = {
    id: string
    intent: AddIntent
    /** Derived per handoff-drafts.md decision 6, recomputed on every autosave. */
    label: string
    createdAt: number
    updatedAt: number
    cragId: string | null
    boulderId: string | null
    isNewSpot: boolean
    newSpotDraft: NewSpotDraft
    newRockDraft: NewRockDraft
    problemDraft: NewProblemDraft
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDB()
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode)
            const req = fn(tx.objectStore(STORE_NAME))
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    } finally {
        db.close()
    }
}

export async function putDraft(draft: AddSheetDraft): Promise<void> {
    await withStore('readwrite', store => store.put(draft))
}

export async function getDraft(id: string): Promise<AddSheetDraft | undefined> {
    return withStore('readonly', store => store.get(id))
}

/** Newest-updated first -- matches the drafts overlay's listing order. */
export async function getAllDrafts(): Promise<AddSheetDraft[]> {
    const all = await withStore<AddSheetDraft[]>('readonly', store => store.getAll())
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteDraft(id: string): Promise<void> {
    await withStore('readwrite', store => store.delete(id))
}

export function formatDraftAge(timestamp: number): string {
    const minutes = Math.floor((Date.now() - timestamp) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}
