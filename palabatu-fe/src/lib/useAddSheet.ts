import { useContext } from 'react';
import { AddSheetContext } from './addSheetContextInstance.js';

export function useAddSheet() {
    const ctx = useContext(AddSheetContext);
    if (!ctx) throw new Error('useAddSheet must be used within AddSheetProvider');
    return ctx;
}
