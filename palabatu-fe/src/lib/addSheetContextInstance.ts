import { createContext } from 'react';
import type { AddIntent } from '../components/add-sheet/types.js';

export type OpenAddSheetOptions = {
    cragId?: string
    boulderId?: string
    intent?: AddIntent
    /** Fired after any successful save -- the caller reloads whatever list
     * it shows (Map.tsx's crag pins, a detail page's rock/problem list).
     * Optional: a caller that doesn't hold onto anything stale can omit it. */
    onAdded?: () => void
}

export type AddSheetContextValue = {
    openAddSheet: (options?: OpenAddSheetOptions) => void
}

export const AddSheetContext = createContext<AddSheetContextValue | null>(null);
